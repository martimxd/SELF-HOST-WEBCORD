import { describe, expect, it } from 'vitest';
import {
  directGroupSchema,
  directNicknameSchema,
  forwardMessageSchema,
  giphySearchSchema,
  initialChangeSchema,
  passwordSchema,
  qualityProfiles,
  registrationInviteSchema,
  updateProfileSchema,
  updateUsernameSchema,
} from '@webcord/shared';
import { requireSuperAdmin } from './permissions.js';
import { contentCategory } from './search.js';

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

  it('limits personal DM nicknames', () => {
    expect(directNicknameSchema.safeParse({ nickname: 'Amigo do trabalho' }).success).toBe(true);
    expect(directNicknameSchema.safeParse({ nickname: 'A'.repeat(41) }).success).toBe(false);
    expect(directNicknameSchema.safeParse({ nickname: '' }).success).toBe(true);
  });

  it('allows private groups with no preselected friends', () => {
    expect(directGroupSchema.safeParse({ name: 'Notas', usernames: [] }).success).toBe(true);
  });

  it('classifies uploaded images and videos by their encoded MIME type', () => {
    expect(contentCategory(
      '[attachment name="foto.png" type="image%2Fpng" size="120"]\nhttps://example.test/file',
    )).toBe('images');
    expect(contentCategory(
      '[attachment name="clip.webm" type="video%2Fwebm" size="240"]\nhttps://example.test/file',
    )).toBe('videos');
    expect(contentCategory(
      '[attachment name="relatorio.pdf" type="application%2Fpdf" size="360"]\nhttps://example.test/file',
    )).toBe('files');
  });

  it('validates username changes with the public username rules', () => {
    expect(updateUsernameSchema.safeParse({ username: 'novo.user-2' }).success).toBe(true);
    expect(updateUsernameSchema.safeParse({ username: 'nome com espaços' }).success).toBe(false);
  });

  it('validates profile limits', () => {
    expect(updateProfileSchema.safeParse({ bio: 'A'.repeat(400), customStatus: 'A trabalhar' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ bio: 'A'.repeat(401) }).success).toBe(false);
  });

  it('validates forwarding destinations', () => {
    expect(forwardMessageSchema.safeParse({
      sourceType: 'channel',
      sourceMessageId: 'message-1',
      targetType: 'direct',
      targetId: 'conversation-1',
    }).success).toBe(true);
    expect(forwardMessageSchema.safeParse({
      sourceType: 'invalid',
      sourceMessageId: '',
      targetType: 'direct',
      targetId: '',
    }).success).toBe(false);
  });

  it('limits GIPHY searches and registration invite durations', () => {
    expect(giphySearchSchema.safeParse({ q: 'reaction', offset: '24' }).success).toBe(true);
    expect(giphySearchSchema.safeParse({ q: 'x'.repeat(51), offset: 500 }).success).toBe(false);
    expect(registrationInviteSchema.safeParse({ expiresIn: '7d' }).success).toBe(true);
    expect(registrationInviteSchema.safeParse({ expiresIn: '30d' }).success).toBe(false);
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
