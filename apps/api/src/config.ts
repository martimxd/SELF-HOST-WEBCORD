import { z } from 'zod';

export const config = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    API_PORT: z.coerce.number().default(4000),
    UPLOAD_DIR: z.string().default('./uploads'),
    LIVEKIT_API_KEY: z.string().default('devkey'),
    LIVEKIT_API_SECRET: z.string().min(32),
  })
  .parse(process.env);
