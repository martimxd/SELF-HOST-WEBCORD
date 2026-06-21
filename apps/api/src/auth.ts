import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { prisma } from './db.js';

export type SessionUser = {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
};

export function signSession(user: SessionUser) {
  return jwt.sign({ sub: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
}

export async function getUserFromToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    const id = typeof payload === 'string' ? '' : payload.sub;
    if (!id || typeof id !== 'string') return null;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.suspended) return null;
    return {
      id: user.id,
      username: user.username,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = await getUserFromToken(request.cookies.webcord_session);
  if (!user) return reply.code(401).send({ error: 'Não autenticado' });
  request.user = user;
}

export async function requireReady(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (!request.user) return;
  if (request.user.mustChangePassword) {
    return reply.code(428).send({ error: 'Alteração inicial obrigatória' });
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}
