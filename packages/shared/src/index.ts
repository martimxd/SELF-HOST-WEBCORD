import { z } from 'zod';

export const serverPermissions = [
  'ADMINISTRATOR',
  'MANAGE_SERVER',
  'MANAGE_CHANNELS',
  'MANAGE_ROLES',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'MANAGE_MESSAGES',
  'MENTION_EVERYONE',
  'SEND_MESSAGES',
  'READ_MESSAGES',
  'ATTACH_FILES',
  'JOIN_CALL',
  'SPEAK_IN_CALL',
  'MUTE_MEMBERS',
  'DEAFEN_MEMBERS',
] as const;

export type ServerPermission = typeof serverPermissions[number];

export const defaultRolePermissions: Record<'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER', ServerPermission[]> = {
  OWNER: [...serverPermissions],
  ADMIN: [...serverPermissions],
  MODERATOR: [
    'MANAGE_CHANNELS',
    'KICK_MEMBERS',
    'BAN_MEMBERS',
    'MANAGE_MESSAGES',
    'SEND_MESSAGES',
    'READ_MESSAGES',
    'ATTACH_FILES',
    'JOIN_CALL',
    'SPEAK_IN_CALL',
    'MUTE_MEMBERS',
    'DEAFEN_MEMBERS',
  ],
  MEMBER: [
    'SEND_MESSAGES',
    'READ_MESSAGES',
    'ATTACH_FILES',
    'JOIN_CALL',
    'SPEAK_IN_CALL',
  ],
};

export const passwordSchema = z
  .string()
  .min(10, 'A password deve ter pelo menos 10 caracteres')
  .regex(/[a-z]/, 'Inclua uma letra minúscula')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
  .regex(/[0-9]/, 'Inclua um número')
  .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo');

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/);

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const initialChangeSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
  })
  .refine((value) => value.username.toLowerCase() !== 'admin', {
    message: 'Escolha um username diferente de admin',
    path: ['username'],
  })
  .refine((value) => value.password !== 'admin', {
    message: 'Escolha uma password diferente da password inicial',
    path: ['password'],
  });

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  isSuperAdmin: z.boolean().default(false),
});

export const registrationInviteSchema = z.object({
  expiresIn: z.enum(['1h', '3d', '7d', 'never']),
});

export const serverSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
});

export const serverUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Indique pelo menos uma alteração',
  });

export const channelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['TEXT', 'VOICE', 'VIDEO']).default('TEXT'),
  category: z.string().trim().max(80).optional(),
  isPrivate: z.boolean().optional(),
  isReadOnly: z.boolean().optional(),
});

export const channelUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    type: z.enum(['TEXT', 'VOICE', 'VIDEO']).optional(),
    category: z.string().trim().max(80).nullable().optional(),
    position: z.coerce.number().int().min(0).max(1000).optional(),
    isPrivate: z.boolean().optional(),
    isReadOnly: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Indique pelo menos uma alteração',
  });

export const channelReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
});

export const messageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  replyToId: z.string().optional(),
});

export const forwardMessageSchema = z.object({
  sourceType: z.enum(['channel', 'direct']),
  sourceMessageId: z.string().min(1),
  targetType: z.enum(['channel', 'direct']),
  targetId: z.string().min(1),
});

export const giphySearchSchema = z.object({
  q: z.string().trim().max(50).default(''),
  offset: z.coerce.number().int().min(0).max(499).default(0),
});

export const gifFavoriteSchema = z.object({
  gifId: z.string().trim().min(1).max(120),
  title: z.string().trim().max(140).default('GIF'),
  url: z.string().url().max(2048),
  previewUrl: z.string().url().max(2048),
  source: z.string().trim().max(30).default('giphy'),
});

export const directConversationSchema = z.object({
  username: usernameSchema,
});

export const friendRequestSchema = z.object({
  username: usernameSchema,
});

export const updateUsernameSchema = z.object({
  username: usernameSchema,
});

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  bio: z.string().trim().max(400).optional(),
  customStatus: z.string().trim().max(80).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Indique pelo menos uma alteração',
});

export const directGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  usernames: z
    .array(usernameSchema)
    .max(9, 'Um grupo pode ter no máximo 10 membros')
    .refine((usernames) => new Set(usernames.map((username) => username.toLowerCase())).size === usernames.length, {
      message: 'Não repita usernames',
    }),
});

export const directGroupMemberSchema = z.object({
  username: usernameSchema,
});

export const directNicknameSchema = z.object({
  nickname: z.string().trim().max(40),
});

export const passwordConfirmationSchema = z.object({
  password: z.string().min(1).max(256),
});

export const serverRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']),
});

export const rolePermissionSchema = z.enum(serverPermissions);

export const customRoleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#8b5cf6'),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  permissions: z.array(rolePermissionSchema).default([]),
});

export const customRoleUpdateSchema = customRoleSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Indique pelo menos uma alteração' },
);

export const roleAssignmentSchema = z.object({
  roleIds: z.array(z.string().min(1)).max(50),
});

export const channelPermissionOverwriteSchema = z.object({
  allowedPermissions: z.array(rolePermissionSchema).default([]),
  deniedPermissions: z.array(rolePermissionSchema).default([]),
});

export const memberNicknameSchema = z.object({
  nickname: z.string().trim().max(40).nullable().optional(),
});

export const memberTimeoutSchema = z.object({
  until: z.string().datetime().nullable(),
  reason: z.string().trim().max(300).default(''),
});

export const memberBanSchema = z.object({
  reason: z.string().trim().max(300).default(''),
});

export const ownershipTransferSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(1).max(256),
});

export const qualityProfiles = {
  low: { width: 854, height: 480, frameRate: 25, maxBitrate: 1_200_000 },
  medium: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  high: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 6_000_000 },
} as const;

export type QualityProfile = keyof typeof qualityProfiles;
