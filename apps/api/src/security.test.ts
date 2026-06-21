import { describe, expect, it } from 'vitest';
import {
  directGroupSchema,
  initialChangeSchema,
  passwordSchema,
  qualityProfiles,
  updateUsernameSchema,
} from '@webcord/shared';
import { requireSuperAdmin } from './permissions.js';

describe('security contracts', () => {
  it('rejects weak passwords', () => {
    expect(passwordSchema.safeParse('password').success).toBe(false);
    expect(passwordSchema.safeParse('Strong-pass-42').success).toBe(true);
  });

  it('requires replacement of initial credentials', () => {
    expect(initialChangeSchema.safeParse({ username: 'admin', password: 'Strong-pass-42' }).success).toBe(false);
    expect(initialChangeSchema.safeParse({ username: 'owner', password: 'Strong-pass-42' }).success).toBe(true);
  });

  it('defines the accepted call quality profiles', () => {
    expect(qualityProfiles.low.frameRate).toBe(25);
    expect(qualityProfiles.medium.height).toBe(720);
    expect(qualityProfiles.high.frameRate).toBe(60);
  });

  it('limits private groups to ten total members', () => {
    const valid = directGroupSchema.safeParse({
      name: 'Equipa',
      usernames: ['ana', 'bruno'],
    });
    const tooMany = directGroupSchema.safeParse({
      name: 'Equipa',
      usernames: Array.from({ length: 10 }, (_, index) => `user${index}`),
    });
    expect(valid.success).toBe(true);
    expect(tooMany.success).toBe(false);
  });

  it('rejects repeated usernames in private groups', () => {
    expect(
      directGroupSchema.safeParse({
        name: 'Equipa',
        usernames: ['alice', 'ALICE'],
      }).success,
    ).toBe(false);
  });

  it('validates username changes with the public username rules', () => {
    expect(updateUsernameSchema.safeParse({ username: 'novo.user-2' }).success).toBe(true);
    expect(updateUsernameSchema.safeParse({ username: 'nome com espaços' }).success).toBe(false);
  });

  it('blocks user administration for non-super-admin accounts', async () => {
    let status = 200;
    let body: unknown;
    const reply = {
      code(value: number) { status = value; return this; },
      send(value: unknown) { body = value; return this; },
    };
    await requireSuperAdmin(
      { user: { id: 'user', username: 'member', isSuperAdmin: false, mustChangePassword: false } } as never,
      reply as never,
    );
    expect(status).toBe(403);
    expect(body).toEqual({ error: 'Apenas o super-admin pode gerir utilizadores' });
  });
});
