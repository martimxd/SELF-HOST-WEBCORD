import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import argon2 from 'argon2';
import sanitizeHtml from 'sanitize-html';
import { Server as SocketServer } from 'socket.io';
import { AccessToken } from 'livekit-server-sdk';
import { ZodError } from 'zod';
import {
  channelSchema,
  createUserSchema,
  directConversationSchema,
  directGroupMemberSchema,
  directGroupSchema,
  friendRequestSchema,
  initialChangeSchema,
  loginSchema,
  messageSchema,
  serverSchema,
  updateUsernameSchema,
} from '@webcord/shared';
import { config } from './config.js';
import { prisma } from './db.js';
import {
  getUserFromToken,
  requireAuth,
  requireReady,
  signSession,
} from './auth.js';
import { requireSuperAdmin } from './permissions.js';

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 ** 3, trustProxy: true });
await app.register(cors, {
  origin: config.WEB_ORIGIN,
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type', 'Accept-Ranges'],
});
await app.register(cookie);
await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });
await app.register(rateLimit, { global: false });
await app.register(multipart, {
  limits: { fileSize: 2 * 1024 ** 3, files: 1 },
});

fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
const onlineUsers = new Map<string, number>();

function sessionCookieOptions(request: FastifyRequest) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: request.protocol === 'https',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };
}

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    const messages = [...new Set(error.issues.map((issue) => issue.message))];
    return reply.code(400).send({
      error: messages.join('. '),
      details: error.issues,
    });
  }
  if ('code' in error && error.code === 'P2002') {
    return reply.code(409).send({ error: 'Esse username já está a ser utilizado' });
  }
  app.log.error(error);
  return reply.code(error.statusCode ?? 500).send({
    error: error.statusCode && error.statusCode < 500 ? error.message : 'Erro interno do servidor',
  });
});

const io = new SocketServer(app.server, {
  cors: { origin: config.WEB_ORIGIN, credentials: true },
});

function publicUser(user: {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  suspended: boolean;
  createdAt?: Date;
  avatarStoredName?: string | null;
  presenceMode?: string;
}) {
  return {
    id: user.id,
    username: user.username,
    isSuperAdmin: user.isSuperAdmin,
    mustChangePassword: user.mustChangePassword,
    suspended: user.suspended,
    createdAt: user.createdAt,
    avatarUrl: user.avatarStoredName ? `/avatars/${user.avatarStoredName}` : null,
    presenceMode: user.presenceMode ?? 'ONLINE',
    status:
      user.presenceMode === 'INVISIBLE' || !onlineUsers.has(user.id) ? 'offline' : 'online',
  };
}

async function isMember(userId: string, serverId: string) {
  return prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
  });
}

async function canManage(userId: string, serverId: string) {
  const member = await isMember(userId, serverId);
  return member && ['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role);
}

async function getDirectConversation(userId: string, conversationId: string) {
  return prisma.directConversation.findFirst({
    where: {
      id: conversationId,
      members: { some: { userId } },
    },
    include: {
      members: {
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              createdAt: true,
              avatarStoredName: true,
              presenceMode: true,
            },
          },
        },
      },
    },
  });
}

function createCdnToken() {
  return randomBytes(48).toString('base64url');
}

function createInviteToken() {
  return randomBytes(32).toString('base64url');
}

function serializeDirectConversation(
  conversation: {
    id: string;
    name: string | null;
    isGroup: boolean;
    ownerId: string | null;
    updatedAt: Date;
    members: Array<{
      user: {
        id: string;
        username: string;
        createdAt: Date;
        avatarStoredName: string | null;
        presenceMode: string;
      };
    }>;
    messages?: Array<{ content: string; createdAt: Date }>;
  },
  currentUserId: string,
) {
  if (!conversation) return null;
  const members = conversation.members.map(({ user }) =>
    publicUser({
      ...user,
      isSuperAdmin: false,
      mustChangePassword: false,
      suspended: false,
    }),
  );
  const otherUser = members.find((member) => member.id !== currentUserId) ?? null;
  return {
    id: conversation.id,
    name: conversation.isGroup ? conversation.name : otherUser?.username,
    isGroup: conversation.isGroup,
    ownerId: conversation.ownerId,
    members,
    otherUser,
    lastMessage: conversation.messages?.[0] ?? null,
    updatedAt: conversation.updatedAt,
  };
}

async function areFriends(userId: string, otherUserId: string) {
  return prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    },
  });
}

app.get('/health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});

app.post(
  '/auth/login',
  { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } },
  async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user || user.suspended) {
      return reply.code(401).send({ error: 'Credenciais inválidas' });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return reply.code(423).send({ error: 'Conta temporariamente bloqueada' });
    }
    if (!(await argon2.verify(user.passwordHash, input.password))) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      return reply.code(401).send({ error: 'Credenciais inválidas' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    reply.setCookie('webcord_session', signSession(publicUser(user)), sessionCookieOptions(request));
    return { user: publicUser(user) };
  },
);

app.post('/auth/logout', async (request, reply) => {
  reply.clearCookie('webcord_session', {
    path: '/',
    sameSite: 'lax',
    secure: request.protocol === 'https',
  });
  return { ok: true };
});

app.get('/auth/me', { preHandler: requireAuth }, async (request) => ({
  user: publicUser((await prisma.user.findUniqueOrThrow({ where: { id: request.user!.id } }))),
}));

app.post('/auth/initial-change', { preHandler: requireAuth }, async (request, reply) => {
  if (!request.user?.mustChangePassword) {
    return reply.code(400).send({ error: 'Alteração inicial já concluída' });
  }
  const input = initialChangeSchema.parse(request.body);
  const user = await prisma.user.update({
    where: { id: request.user.id },
    data: {
      username: input.username,
      passwordHash: await argon2.hash(input.password),
      mustChangePassword: false,
    },
  });
  reply.setCookie('webcord_session', signSession(publicUser(user)), sessionCookieOptions(request));
  return { user: publicUser(user) };
});

app.get('/admin/users', { preHandler: [requireReady, requireSuperAdmin] }, async () => {
  return {
    users: (await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })).map(publicUser),
  };
});

app.post('/admin/users', { preHandler: [requireReady, requireSuperAdmin] }, async (request, reply) => {
  const input = createUserSchema.parse(request.body);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      passwordHash: await argon2.hash(input.password),
      isSuperAdmin: input.isSuperAdmin,
    },
  });
  return reply.code(201).send({ user: publicUser(user) });
});

app.patch('/admin/users/:id', { preHandler: [requireReady, requireSuperAdmin] }, async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as { suspended?: boolean; password?: string; username?: string };
  const data: Record<string, unknown> = {};
  if (typeof body.suspended === 'boolean') data.suspended = body.suspended;
  if (body.username) data.username = body.username;
  if (body.password) {
    createUserSchema.pick({ password: true }).parse({ password: body.password });
    data.passwordHash = await argon2.hash(body.password);
  }
  const user = await prisma.user.update({ where: { id }, data });
  return { user: publicUser(user) };
});

app.delete('/admin/users/:id', { preHandler: [requireReady, requireSuperAdmin] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  if (id === request.user!.id) return reply.code(400).send({ error: 'Não pode apagar a própria conta' });
  await prisma.user.delete({ where: { id } });
  return { ok: true };
});

app.get('/admin/stats', { preHandler: [requireReady, requireSuperAdmin] }, async () => {
  const [users, servers, channels, uploads] = await Promise.all([
    prisma.user.count(),
    prisma.server.count(),
    prisma.channel.count(),
    prisma.upload.aggregate({ _sum: { size: true } }),
  ]);
  return { users, servers, channels, uploadBytes: Number(uploads._sum.size ?? 0n) };
});

app.get('/admin/settings', { preHandler: [requireReady, requireSuperAdmin] }, async () => {
  const settings = await prisma.setting.findMany();
  return Object.fromEntries(settings.map((item) => [item.key, item.value]));
});

app.put('/admin/settings', { preHandler: [requireReady, requireSuperAdmin] }, async (request) => {
  const body = request.body as { publicRegistration?: boolean; maxUploadBytes?: number };
  if (typeof body.publicRegistration === 'boolean') {
    await prisma.setting.upsert({
      where: { key: 'publicRegistration' },
      create: { key: 'publicRegistration', value: String(body.publicRegistration) },
      update: { value: String(body.publicRegistration) },
    });
  }
  if (body.maxUploadBytes && body.maxUploadBytes > 0) {
    await prisma.setting.upsert({
      where: { key: 'maxUploadBytes' },
      create: { key: 'maxUploadBytes', value: String(body.maxUploadBytes) },
      update: { value: String(body.maxUploadBytes) },
    });
  }
  return { ok: true };
});

app.get('/users/:username/profile', { preHandler: requireReady }, async (request, reply) => {
  const { username } = request.params as { username: string };
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, createdAt: true, avatarStoredName: true, presenceMode: true },
  });
  if (!user) return reply.code(404).send({ error: 'Utilizador não encontrado' });
  return { user: publicUser({ ...user, isSuperAdmin: false, mustChangePassword: false, suspended: false }) };
});

app.post('/users/me/avatar', { preHandler: requireReady }, async (request, reply) => {
  const file = await request.file({ limits: { fileSize: 10 * 1024 ** 2 } });
  if (!file) return reply.code(400).send({ error: 'Escolha uma imagem' });
  const allowed = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
    ['image/gif', '.gif'],
    ['image/avif', '.avif'],
  ]);
  const extension = allowed.get(file.mimetype);
  if (!extension) {
    file.file.resume();
    return reply.code(415).send({ error: 'Use uma imagem JPG, PNG, WebP, GIF ou AVIF' });
  }
  const avatarDir = path.join(config.UPLOAD_DIR, 'avatars');
  fs.mkdirSync(avatarDir, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  await pipeline(file.file, fs.createWriteStream(path.join(avatarDir, storedName)));
  if (file.file.truncated) {
    fs.rmSync(path.join(avatarDir, storedName), { force: true });
    return reply.code(413).send({ error: 'A fotografia de perfil não pode exceder 10 MB' });
  }
  const previous = await prisma.user.findUnique({ where: { id: request.user!.id } });
  const user = await prisma.user.update({
    where: { id: request.user!.id },
    data: { avatarStoredName: storedName },
  });
  if (previous?.avatarStoredName) {
    fs.rmSync(path.join(avatarDir, previous.avatarStoredName), { force: true });
  }
  return { user: publicUser(user) };
});

app.delete('/users/me/avatar', { preHandler: requireReady }, async (request) => {
  const previous = await prisma.user.findUnique({ where: { id: request.user!.id } });
  const user = await prisma.user.update({
    where: { id: request.user!.id },
    data: { avatarStoredName: null },
  });
  if (previous?.avatarStoredName) {
    fs.rmSync(path.join(config.UPLOAD_DIR, 'avatars', previous.avatarStoredName), { force: true });
  }
  return { user: publicUser(user) };
});

app.patch('/users/me', { preHandler: requireReady }, async (request, reply) => {
  const input = updateUsernameSchema.parse(request.body);
  const user = await prisma.user.update({
    where: { id: request.user!.id },
    data: { username: input.username },
  });
  reply.setCookie('webcord_session', signSession(publicUser(user)), sessionCookieOptions(request));
  io.emit('user:update', publicUser(user));
  return { user: publicUser(user) };
});

app.put('/users/me/presence', { preHandler: requireReady }, async (request, reply) => {
  const { mode } = request.body as { mode?: string };
  if (!mode || !['ONLINE', 'INVISIBLE'].includes(mode)) {
    return reply.code(400).send({ error: 'Estado de presença inválido' });
  }
  const user = await prisma.user.update({
    where: { id: request.user!.id },
    data: { presenceMode: mode },
  });
  io.emit('presence:update', {
    userId: user.id,
    status: mode === 'INVISIBLE' ? 'offline' : onlineUsers.has(user.id) ? 'online' : 'offline',
  });
  return { user: publicUser(user) };
});

app.get('/avatars/:storedName', async (request, reply) => {
  const { storedName } = request.params as { storedName: string };
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif|avif)$/.test(storedName)) {
    return reply.code(404).send();
  }
  const filePath = path.join(config.UPLOAD_DIR, 'avatars', storedName);
  if (!fs.existsSync(filePath)) return reply.code(404).send();
  const extension = path.extname(storedName);
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
  };
  reply.header('Content-Type', contentTypes[extension] ?? 'application/octet-stream');
  reply.header('Cache-Control', 'public, max-age=86400');
  return reply.send(fs.createReadStream(filePath));
});

app.get('/friends', { preHandler: requireReady }, async (request) => {
  const userId = request.user!.id;
  const [accepted, incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: { requester: true, addressee: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: { requester: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      include: { addressee: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return {
    friends: accepted.map((friendship) =>
      publicUser(friendship.requesterId === userId ? friendship.addressee : friendship.requester),
    ),
    incoming: incoming.map((friendship) => ({
      id: friendship.id,
      user: publicUser(friendship.requester),
    })),
    outgoing: outgoing.map((friendship) => ({
      id: friendship.id,
      user: publicUser(friendship.addressee),
    })),
  };
});

app.post('/friends/link', { preHandler: requireReady }, async (request) => {
  const existing = await prisma.friendInvite.findUnique({
    where: { ownerId: request.user!.id },
  });
  const invite = existing ?? await prisma.friendInvite.create({
    data: { ownerId: request.user!.id, token: createInviteToken() },
  });
  return { token: invite.token };
});

app.post('/invites/friend/:token', { preHandler: requireReady }, async (request, reply) => {
  const { token } = request.params as { token: string };
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return reply.code(404).send({ error: 'Link de amizade inválido' });
  }
  const invite = await prisma.friendInvite.findUnique({
    where: { token },
    include: { owner: true },
  });
  if (!invite || invite.owner.suspended) {
    return reply.code(404).send({ error: 'Link de amizade inválido' });
  }
  if (invite.ownerId === request.user!.id) {
    return reply.code(400).send({ error: 'Este link de amizade pertence à sua conta' });
  }
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: request.user!.id, addresseeId: invite.ownerId },
        { requesterId: invite.ownerId, addresseeId: request.user!.id },
      ],
    },
  });
  if (existing) {
    await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: 'ACCEPTED' },
    });
  } else {
    await prisma.friendship.create({
      data: {
        requesterId: request.user!.id,
        addresseeId: invite.ownerId,
        status: 'ACCEPTED',
      },
    });
  }
  io.to(`user:${invite.ownerId}`).to(`user:${request.user!.id}`).emit('friend:update');
  return { friend: publicUser(invite.owner) };
});

app.post('/friends', { preHandler: requireReady }, async (request, reply) => {
  const input = friendRequestSchema.parse(request.body);
  const addressee = await prisma.user.findUnique({ where: { username: input.username } });
  if (!addressee || addressee.suspended) {
    return reply.code(404).send({ error: 'Não existe nenhum utilizador com esse username' });
  }
  if (addressee.id === request.user!.id) {
    return reply.code(400).send({ error: 'Não pode adicionar a própria conta' });
  }
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: request.user!.id, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: request.user!.id },
      ],
    },
  });
  if (existing?.status === 'ACCEPTED') {
    return reply.code(409).send({ error: 'Este utilizador já está na sua lista de amigos' });
  }
  if (existing?.requesterId === request.user!.id) {
    return reply.code(409).send({ error: 'O pedido de amizade já foi enviado' });
  }
  if (existing) {
    await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: 'ACCEPTED' },
    });
    io.to(`user:${addressee.id}`).to(`user:${request.user!.id}`).emit('friend:update');
    return reply.code(201).send({ accepted: true, user: publicUser(addressee) });
  }
  const friendship = await prisma.friendship.create({
    data: { requesterId: request.user!.id, addresseeId: addressee.id },
  });
  io.to(`user:${addressee.id}`).emit('friend:update');
  return reply.code(201).send({
    request: { id: friendship.id, user: publicUser(addressee) },
  });
});

app.post('/friends/:id/accept', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const friendship = await prisma.friendship.findFirst({
    where: { id, addresseeId: request.user!.id },
    include: { requester: true },
  });
  if (!friendship) return reply.code(404).send({ error: 'Pedido de amizade não encontrado' });
  if (friendship.status !== 'ACCEPTED') {
    await prisma.friendship.update({ where: { id }, data: { status: 'ACCEPTED' } });
  }
  io.to(`user:${friendship.requesterId}`).to(`user:${request.user!.id}`).emit('friend:update');
  return { friend: publicUser(friendship.requester) };
});

app.delete('/friends/:id', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const friendship = await prisma.friendship.findFirst({
    where: {
      id,
      OR: [{ requesterId: request.user!.id }, { addresseeId: request.user!.id }],
    },
  });
  if (!friendship) return reply.code(404).send({ error: 'Relação de amizade não encontrada' });
  await prisma.friendship.delete({ where: { id } });
  io.to(`user:${friendship.requesterId}`).to(`user:${friendship.addresseeId}`).emit('friend:update');
  return { ok: true };
});

app.delete('/friends/user/:userId', { preHandler: requireReady }, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: request.user!.id, addresseeId: userId },
        { requesterId: userId, addresseeId: request.user!.id },
      ],
    },
  });
  if (!friendship) return reply.code(404).send({ error: 'Relação de amizade não encontrada' });
  await prisma.friendship.delete({ where: { id: friendship.id } });
  io.to(`user:${friendship.requesterId}`).to(`user:${friendship.addresseeId}`).emit('friend:update');
  return { ok: true };
});

app.get('/direct-conversations', { preHandler: requireReady }, async (request) => {
  const conversations = await prisma.directConversation.findMany({
    where: { members: { some: { userId: request.user!.id } } },
    include: {
      members: {
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              createdAt: true,
              avatarStoredName: true,
              presenceMode: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return {
    conversations: conversations.map((conversation) =>
      serializeDirectConversation(conversation, request.user!.id),
    ),
  };
});

app.post('/direct-conversations', { preHandler: requireReady }, async (request, reply) => {
  const input = directConversationSchema.parse(request.body);
  const otherUser = await prisma.user.findUnique({ where: { username: input.username } });
  if (!otherUser || otherUser.suspended) {
    return reply.code(404).send({ error: 'Não existe nenhum utilizador com esse username' });
  }
  if (otherUser.id === request.user!.id) {
    return reply.code(400).send({ error: 'Não pode iniciar uma DM consigo próprio' });
  }
  if (!(await areFriends(request.user!.id, otherUser.id))) {
    return reply.code(403).send({ error: 'Adicione este utilizador como amigo antes de iniciar uma DM' });
  }
  const currentUserId = request.user!.id;
  const userAId = currentUserId < otherUser.id ? currentUserId : otherUser.id;
  const userBId = currentUserId < otherUser.id ? otherUser.id : currentUserId;
  const conversation = await prisma.directConversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: {
      userAId,
      userBId,
      members: { create: [{ userId: userAId }, { userId: userBId }] },
    },
    update: {},
    include: {
      members: {
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              createdAt: true,
              avatarStoredName: true,
              presenceMode: true,
            },
          },
        },
      },
    },
  });
  return reply.code(201).send({
    conversation: serializeDirectConversation(conversation, currentUserId),
  });
});

app.post('/direct-groups', { preHandler: requireReady }, async (request, reply) => {
  const input = directGroupSchema.parse(request.body);
  const usernames = [...new Set(input.usernames)];
  const users = await prisma.user.findMany({
    where: { username: { in: usernames }, suspended: false },
  });
  if (users.length !== usernames.length) {
    return reply.code(404).send({ error: 'Um ou mais usernames não existem' });
  }
  const friendshipChecks = await Promise.all(
    users.map((user) => areFriends(request.user!.id, user.id)),
  );
  if (friendshipChecks.some((friendship) => !friendship)) {
    return reply.code(403).send({ error: 'Só pode adicionar amigos aos grupos privados' });
  }
  const conversation = await prisma.directConversation.create({
    data: {
      name: input.name,
      isGroup: true,
      ownerId: request.user!.id,
      members: {
        create: [
          { userId: request.user!.id },
          ...users.map((user) => ({ userId: user.id })),
        ],
      },
    },
    include: {
      members: {
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              createdAt: true,
              avatarStoredName: true,
              presenceMode: true,
            },
          },
        },
      },
    },
  });
  return reply.code(201).send({
    conversation: serializeDirectConversation(conversation, request.user!.id),
  });
});

app.post('/direct-conversations/:id/members', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const input = directGroupMemberSchema.parse(request.body);
  const conversation = await getDirectConversation(request.user!.id, id);
  if (!conversation?.isGroup || conversation.ownerId !== request.user!.id) {
    return reply.code(403).send({ error: 'Apenas o criador do grupo pode adicionar membros' });
  }
  if (conversation.members.length >= 10) {
    return reply.code(409).send({ error: 'O grupo já atingiu o limite de 10 membros' });
  }
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  if (!user || user.suspended) {
    return reply.code(404).send({ error: 'Não existe nenhum utilizador com esse username' });
  }
  if (conversation.members.some((member) => member.user.id === user.id)) {
    return reply.code(409).send({ error: 'Este utilizador já pertence ao grupo' });
  }
  if (!(await areFriends(request.user!.id, user.id))) {
    return reply.code(403).send({ error: 'Só pode adicionar amigos ao grupo' });
  }
  const member = await prisma.$transaction(async (transaction) => {
    const memberCount = await transaction.directConversationMember.count({
      where: { conversationId: id },
    });
    if (memberCount >= 10) return null;
    return transaction.directConversationMember.create({
      data: { conversationId: id, userId: user.id },
    });
  }, {
    isolationLevel: 'Serializable',
  });
  if (!member) return reply.code(409).send({ error: 'O grupo já atingiu o limite de 10 membros' });
  const updated = await getDirectConversation(request.user!.id, id);
  io.to(`dm:${id}`).emit('dm:conversation:update', serializeDirectConversation(updated!, request.user!.id));
  return { conversation: serializeDirectConversation(updated!, request.user!.id) };
});

app.delete(
  '/direct-conversations/:id/members/:userId',
  { preHandler: requireReady },
  async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const conversation = await getDirectConversation(request.user!.id, id);
    if (!conversation?.isGroup) {
      return reply.code(404).send({ error: 'Grupo não encontrado' });
    }
    const isLeaving = userId === request.user!.id;
    if (!isLeaving && conversation.ownerId !== request.user!.id) {
      return reply.code(403).send({ error: 'Apenas o criador pode remover outros membros' });
    }
    if (conversation.ownerId === userId) {
      return reply.code(400).send({ error: 'O criador não pode sair sem apagar o grupo' });
    }
    await prisma.directConversationMember.delete({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    io.to(`dm:${id}`).emit('dm:member:removed', { conversationId: id, userId });
    return { ok: true };
  },
);

app.get(
  '/direct-conversations/:id/messages',
  { preHandler: requireReady },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getDirectConversation(request.user!.id, id))) {
      return reply.code(403).send({ error: 'Sem acesso a esta conversa' });
    }
    const messages = await prisma.directMessage.findMany({
      where: { conversationId: id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarStoredName: true,
            presenceMode: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return {
      messages: messages.map((message) => ({
        ...message,
        author: publicUser({
          ...message.author,
          isSuperAdmin: false,
          mustChangePassword: false,
          suspended: false,
        }),
      })),
    };
  },
);

app.post(
  '/direct-conversations/:id/messages',
  { preHandler: requireReady },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const conversation = await getDirectConversation(request.user!.id, id);
    if (!conversation) return reply.code(403).send({ error: 'Sem acesso a esta conversa' });
    const input = messageSchema.parse(request.body);
    const content = sanitizeHtml(input.content, { allowedTags: [], allowedAttributes: {} });
    const message = await prisma.directMessage.create({
      data: { content, authorId: request.user!.id, conversationId: id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatarStoredName: true,
            presenceMode: true,
          },
        },
      },
    });
    await prisma.directConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    const responseMessage = {
      ...message,
      author: publicUser({
        ...message.author,
        isSuperAdmin: false,
        mustChangePassword: false,
        suspended: false,
      }),
    };
    io.to(`dm:${id}`).emit('dm:message:new', responseMessage);
    return reply.code(201).send({ message: responseMessage });
  },
);

app.post(
  '/direct-conversations/:id/call-token',
  { preHandler: requireReady },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getDirectConversation(request.user!.id, id))) {
      return reply.code(403).send({ error: 'Sem acesso a esta chamada' });
    }
    const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
      identity: request.user!.id,
      name: request.user!.username,
    });
    token.addGrant({
      roomJoin: true,
      room: `dm-${id}`,
      canPublish: true,
      canSubscribe: true,
    });
    return { token: await token.toJwt() };
  },
);

app.post(
  '/direct-conversations/:id/uploads',
  { preHandler: requireReady },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await getDirectConversation(request.user!.id, id))) {
      return reply.code(403).send({ error: 'Sem acesso a esta conversa' });
    }
    const maxSetting = await prisma.setting.findUnique({ where: { key: 'maxUploadBytes' } });
    const maxBytes = Number(maxSetting?.value ?? 2 * 1024 ** 3);
    const file = await request.file({ limits: { fileSize: maxBytes } });
    if (!file) return reply.code(400).send({ error: 'Ficheiro em falta' });
    const blocked = ['text/html', 'image/svg+xml', 'application/javascript'];
    const storedName = `${randomUUID()}${path.extname(file.filename).slice(0, 12)}`;
    await pipeline(file.file, fs.createWriteStream(path.join(config.UPLOAD_DIR, storedName)));
    if (file.file.truncated) {
      fs.rmSync(path.join(config.UPLOAD_DIR, storedName), { force: true });
      return reply.code(413).send({ error: `O ficheiro excede o limite de ${maxBytes} bytes` });
    }
    const stat = fs.statSync(path.join(config.UPLOAD_DIR, storedName));
    const publicToken = createCdnToken();
    const upload = await prisma.upload.create({
      data: {
        originalName: file.filename,
        storedName,
        publicToken,
        mimeType: blocked.includes(file.mimetype)
          ? 'application/octet-stream'
          : file.mimetype || 'application/octet-stream',
        size: stat.size,
        userId: request.user!.id,
        directConversationId: id,
      },
    });
    return reply.code(201).send({
      upload: {
        id: upload.id,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        size: Number(upload.size),
        url: `/api/cdn/${publicToken}`,
      },
    });
  },
);

app.get('/servers', { preHandler: requireReady }, async (request) => ({
  servers: (
    await prisma.server.findMany({
      where: { members: { some: { userId: request.user!.id } } },
      include: {
        channels: { orderBy: { position: 'asc' } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                createdAt: true,
                avatarStoredName: true,
                presenceMode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  ).map((server) => ({
    ...server,
    members: server.members.map((member) => ({
      ...member,
      user: publicUser({
        ...member.user,
        isSuperAdmin: false,
        mustChangePassword: false,
        suspended: false,
      }),
    })),
  })),
}));

app.post('/servers', { preHandler: requireReady }, async (request, reply) => {
  const input = serverSchema.parse(request.body);
  const server = await prisma.server.create({
    data: {
      ...input,
      ownerId: request.user!.id,
      members: { create: { userId: request.user!.id, role: 'OWNER' } },
      channels: { create: { name: 'geral', type: 'TEXT' } },
    },
    include: {
      channels: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              createdAt: true,
              avatarStoredName: true,
              presenceMode: true,
            },
          },
        },
      },
    },
  });
  return reply.code(201).send({
    server: {
      ...server,
      members: server.members.map((member) => ({
        ...member,
        user: publicUser({
          ...member.user,
          isSuperAdmin: false,
          mustChangePassword: false,
          suspended: false,
        }),
      })),
    },
  });
});

app.post('/servers/:id/invites', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!(await isMember(request.user!.id, id))) {
    return reply.code(403).send({ error: 'Tem de pertencer ao servidor para criar um convite' });
  }
  const invite = await prisma.serverInvite.create({
    data: {
      token: createInviteToken(),
      serverId: id,
      creatorId: request.user!.id,
    },
  });
  return reply.code(201).send({ token: invite.token });
});

app.post('/invites/server/:token', { preHandler: requireReady }, async (request, reply) => {
  const { token } = request.params as { token: string };
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return reply.code(404).send({ error: 'Convite de servidor inválido' });
  }
  const invite = await prisma.serverInvite.findUnique({
    where: { token },
    include: { server: { select: { id: true, name: true } } },
  });
  if (!invite) return reply.code(404).send({ error: 'Convite de servidor inválido' });
  await prisma.serverMember.upsert({
    where: {
      userId_serverId: {
        userId: request.user!.id,
        serverId: invite.serverId,
      },
    },
    create: {
      userId: request.user!.id,
      serverId: invite.serverId,
      role: 'MEMBER',
    },
    update: {},
  });
  io.emit('server:member:update', { serverId: invite.serverId });
  return { server: invite.server };
});

app.delete('/servers/:id', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const server = await prisma.server.findUnique({ where: { id } });
  if (!server || server.ownerId !== request.user!.id) {
    return reply.code(403).send({ error: 'Apenas o proprietário pode apagar o servidor' });
  }
  await prisma.server.delete({ where: { id } });
  return { ok: true };
});

app.post('/servers/:id/channels', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  if (!(await canManage(request.user!.id, id))) {
    return reply.code(403).send({ error: 'Sem permissão' });
  }
  const input = channelSchema.parse(request.body);
  const count = await prisma.channel.count({ where: { serverId: id } });
  const channel = await prisma.channel.create({
    data: { ...input, serverId: id, position: count },
  });
  io.to(`server:${id}`).emit('channel:created', channel);
  return reply.code(201).send({ channel });
});

app.get('/channels/:id/messages', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const { cursor } = request.query as { cursor?: string };
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel || !(await isMember(request.user!.id, channel.serverId))) {
    return reply.code(403).send({ error: 'Sem acesso ao canal' });
  }
  const messages = await prisma.message.findMany({
    where: { channelId: id },
    include: {
      author: { select: { id: true, username: true, avatarStoredName: true } },
      uploads: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return {
    messages: messages.reverse().map((message) => ({
      ...message,
      author: {
        id: message.author.id,
        username: message.author.username,
        avatarUrl: message.author.avatarStoredName
          ? `/avatars/${message.author.avatarStoredName}`
          : null,
      },
      uploads: message.uploads.map((upload) => ({ ...upload, size: Number(upload.size) })),
    })),
  };
});

app.post('/channels/:id/messages', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel || channel.type !== 'TEXT' || !(await isMember(request.user!.id, channel.serverId))) {
    return reply.code(403).send({ error: 'Sem acesso ao canal' });
  }
  const input = messageSchema.parse(request.body);
  const content = sanitizeHtml(input.content, { allowedTags: [], allowedAttributes: {} });
  const message = await prisma.message.create({
    data: { content, replyToId: input.replyToId, authorId: request.user!.id, channelId: id },
    include: {
      author: { select: { id: true, username: true, avatarStoredName: true } },
      uploads: true,
    },
  });
  const responseMessage = {
    ...message,
    author: {
      id: message.author.id,
      username: message.author.username,
      avatarUrl: message.author.avatarStoredName
        ? `/avatars/${message.author.avatarStoredName}`
        : null,
    },
  };
  io.to(`channel:${id}`).emit('message:new', responseMessage);
  return reply.code(201).send({ message: responseMessage });
});

app.post('/channels/:id/uploads', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel || !(await isMember(request.user!.id, channel.serverId))) {
    return reply.code(403).send({ error: 'Sem acesso ao canal' });
  }
  const maxSetting = await prisma.setting.findUnique({ where: { key: 'maxUploadBytes' } });
  const maxBytes = Number(maxSetting?.value ?? 2 * 1024 ** 3);
  const file = await request.file({ limits: { fileSize: maxBytes } });
  if (!file) return reply.code(400).send({ error: 'Ficheiro em falta' });
  const blocked = ['text/html', 'image/svg+xml', 'application/javascript'];
  const storedName = `${randomUUID()}${path.extname(file.filename).slice(0, 12)}`;
  await pipeline(file.file, fs.createWriteStream(path.join(config.UPLOAD_DIR, storedName)));
  if (file.file.truncated) {
    fs.rmSync(path.join(config.UPLOAD_DIR, storedName), { force: true });
    return reply.code(413).send({ error: `O ficheiro excede o limite de ${maxBytes} bytes` });
  }
  const stat = fs.statSync(path.join(config.UPLOAD_DIR, storedName));
  const upload = await prisma.upload.create({
    data: {
      originalName: file.filename,
      storedName,
      publicToken: createCdnToken(),
      mimeType: blocked.includes(file.mimetype) ? 'application/octet-stream' : file.mimetype,
      size: stat.size,
      userId: request.user!.id,
      channelId: id,
    },
  });
  return reply.code(201).send({
    upload: {
      id: upload.id,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      size: Number(upload.size),
      url: `/api/cdn/${upload.publicToken}`,
    },
  });
});

app.get('/cdn/:token', async (request, reply) => {
  const { token } = request.params as { token: string };
  if (!/^(?:[A-Za-z0-9_-]{64}|[a-f0-9]{144}[a-z0-9.]{0,12})$/.test(token)) {
    return reply.code(404).send();
  }
  const upload = await prisma.upload.findUnique({ where: { publicToken: token } });
  if (!upload) return reply.code(404).send();
  const filePath = path.join(config.UPLOAD_DIR, upload.storedName);
  if (!fs.existsSync(filePath)) return reply.code(404).send();
  const dangerous = ['text/html', 'image/svg+xml', 'application/javascript'];
  reply.header(
    'Content-Type',
    dangerous.includes(upload.mimeType) ? 'application/octet-stream' : upload.mimeType,
  );
  reply.header('Accept-Ranges', 'bytes');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Cache-Control', 'public, max-age=31536000, immutable');
  const disposition = upload.mimeType === 'application/octet-stream' ? 'attachment' : 'inline';
  reply.header(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`,
  );
  const range = request.headers.range;
  if (range) {
    const match = range.match(/^bytes=(\d+)-(\d*)$/);
    if (!match?.[1]) return reply.code(416).send();
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : Number(upload.size) - 1;
    if (start < 0 || end < start || end >= Number(upload.size)) {
      return reply.code(416).send();
    }
    reply.code(206);
    reply.header('Content-Range', `bytes ${start}-${end}/${upload.size}`);
    reply.header('Content-Length', String(end - start + 1));
    return reply.send(fs.createReadStream(filePath, { start, end }));
  }
  reply.header('Content-Length', upload.size.toString());
  return reply.send(fs.createReadStream(filePath));
});

app.get('/uploads/:id', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const upload = await prisma.upload.findUnique({
    where: { id },
    include: { channel: true },
  });
  if (!upload || !upload.channel || !(await isMember(request.user!.id, upload.channel.serverId))) {
    return reply.code(404).send({ error: 'Ficheiro não encontrado' });
  }
  reply.header('Content-Type', upload.mimeType);
  reply.header('Content-Length', upload.size.toString());
  reply.header(
    'Content-Disposition',
    `${upload.mimeType === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(upload.originalName)}"`,
  );
  return reply.send(fs.createReadStream(path.join(config.UPLOAD_DIR, upload.storedName)));
});

app.post('/channels/:id/call-token', { preHandler: requireReady }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel || channel.type === 'TEXT' || !(await isMember(request.user!.id, channel.serverId))) {
    return reply.code(403).send({ error: 'Sem permissão para entrar na chamada' });
  }
  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity: request.user!.id,
    name: request.user!.username,
  });
  token.addGrant({ roomJoin: true, room: `channel-${id}`, canPublish: true, canSubscribe: true });
  return { token: await token.toJwt() };
});

io.use(async (socket, next) => {
  const token = socket.handshake.headers.cookie
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('webcord_session='))
    ?.split('=')[1];
  const user = await getUserFromToken(token);
  if (!user || user.mustChangePassword) return next(new Error('unauthorized'));
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const connectedUserId = socket.data.user.id as string;
  socket.join(`user:${connectedUserId}`);
  onlineUsers.set(connectedUserId, (onlineUsers.get(connectedUserId) ?? 0) + 1);
  prisma.user
    .findUnique({ where: { id: connectedUserId }, select: { presenceMode: true } })
    .then((connectedUser) => {
      io.emit('presence:update', {
        userId: connectedUserId,
        status: connectedUser?.presenceMode === 'INVISIBLE' ? 'offline' : 'online',
      });
    });
  socket.on('server:join', async (serverId: string) => {
    if (await isMember(socket.data.user.id, serverId)) socket.join(`server:${serverId}`);
  });
  socket.on('channel:join', async (channelId: string) => {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (channel && (await isMember(socket.data.user.id, channel.serverId))) {
      socket.join(`channel:${channelId}`);
    }
  });
  socket.on('dm:join', async (conversationId: string) => {
    if (await getDirectConversation(socket.data.user.id, conversationId)) {
      socket.join(`dm:${conversationId}`);
    }
  });
  socket.on('typing', (channelId: string) => {
    socket.to(`channel:${channelId}`).emit('typing', {
      channelId,
      user: socket.data.user.username,
    });
  });
  socket.on('disconnect', () => {
    const remaining = Math.max(0, (onlineUsers.get(connectedUserId) ?? 1) - 1);
    if (remaining === 0) {
      onlineUsers.delete(connectedUserId);
      io.emit('presence:update', { userId: connectedUserId, status: 'offline' });
    } else {
      onlineUsers.set(connectedUserId, remaining);
    }
  });
});

const shutdown = async () => {
  io.close();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
