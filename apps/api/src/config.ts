import { z } from 'zod';

const booleanEnv = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
    .optional()
    .transform((value) => {
      if (!value) return defaultValue;
      return ['true', '1', 'yes', 'on'].includes(value);
    });

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
    GIPHY_API_KEY: z.string().default(''),
    GIPHY_RATING: z.enum(['g', 'pg', 'pg-13', 'r']).default('pg-13'),
    GIPHY_COUNTRY_CODE: z.string().length(2).default('PT'),
    MEDIA_OPTIMIZATION_ENABLED: booleanEnv(true),
    MEDIA_IMAGE_MAX_WIDTH: z.coerce.number().int().min(320).max(4096).default(1920),
    MEDIA_IMAGE_QUALITY: z.coerce.number().int().min(50).max(100).default(82),
    MEDIA_THUMBNAIL_WIDTH: z.coerce.number().int().min(120).max(1024).default(480),
    UPLOAD_CLEANUP_ENABLED: booleanEnv(false),
    UPLOAD_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  })
  .parse(process.env);
