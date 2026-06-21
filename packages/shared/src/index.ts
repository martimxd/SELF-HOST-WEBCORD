import { z } from 'zod';

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

export const serverSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
});

export const channelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['TEXT', 'VOICE', 'VIDEO']).default('TEXT'),
});

export const messageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  replyToId: z.string().optional(),
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

export const directGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  usernames: z
    .array(usernameSchema)
    .min(2, 'Escolha pelo menos duas pessoas')
    .max(9, 'Um grupo pode ter no máximo 10 membros')
    .refine((usernames) => new Set(usernames.map((username) => username.toLowerCase())).size === usernames.length, {
      message: 'Não repita usernames',
    }),
});

export const directGroupMemberSchema = z.object({
  username: usernameSchema,
});

export const qualityProfiles = {
  low: { width: 854, height: 480, frameRate: 25, maxBitrate: 1_200_000 },
  medium: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  high: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 6_000_000 },
} as const;

export type QualityProfile = keyof typeof qualityProfiles;
