import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, Clock, Copy, HardDrive, Image, Link2, Plus, RotateCcw, Server as ServerIcon, Trash2, Users } from 'lucide-react';
import { api, copyText } from '../api';
import type { User } from '../types';
import { useI18n, type Language, type SiteConfig } from '../i18n';

type Stats = { users: number; servers: number; channels: number; uploadBytes: number };
type RegistrationInvite = {
  id: string;
  token: string;
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
};

export function Admin({ user, onBack }: { user: User; onBack: () => void }) {
  const { t, siteConfig, refreshSiteConfig } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invites, setInvites] = useState<RegistrationInvite[]>([]);
  const [expiresIn, setExpiresIn] = useState<'1h' | '3d' | '7d' | 'never'>('7d');
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(siteConfig.defaultLanguage);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const load = () => {
    api<{ users: User[] }>('/admin/users').then((result) => setUsers(result.users));
    api<Stats>('/admin/stats').then(setStats);
    api<{ invites: RegistrationInvite[] }>('/admin/registration-invites').then((result) => setInvites(result.invites));
    api<Record<string, string>>('/admin/settings')
      .then((settings) => {
        if (settings.defaultLanguage === 'pt' || settings.defaultLanguage === 'en' || settings.defaultLanguage === 'fr') {
          setDefaultLanguage(settings.defaultLanguage);
        } else {
          setDefaultLanguage(siteConfig.defaultLanguage);
        }
      })
      .catch(() => setDefaultLanguage(siteConfig.defaultLanguage));
  };

  const createInvite = async () => {
    const result = await api<{ invite: RegistrationInvite }>('/admin/registration-invites', {
      method: 'POST',
      body: JSON.stringify({ expiresIn }),
    });
    const link = `${window.location.origin}/?register=${result.invite.token}`;
    await copyText(link);
    setNotice(t('registrationLinkCopied'));
    setInvites((items) => [result.invite, ...items]);
  };
  useEffect(load, [siteConfig.defaultLanguage]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    await api('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, isSuperAdmin: false }),
    });
    setUsername('');
    setPassword('');
    load();
  };

  const saveDefaultLanguage = async () => {
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ defaultLanguage }),
      });
      await refreshSiteConfig();
      setNotice(t('saved'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const uploadBranding = async (kind: 'site-icon' | 'favicon' | 'login-background', file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      await api<{ config: SiteConfig }>(`/admin/branding/${kind}`, {
        method: 'POST',
        body: form,
      });
      await refreshSiteConfig();
      setNotice(t('brandingUpdated'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const resetBranding = async (kind: 'site-icon' | 'favicon' | 'login-background') => {
    try {
      await api<{ config: SiteConfig }>(`/admin/branding/${kind}`, { method: 'DELETE' });
      await refreshSiteConfig();
      setNotice(t('defaultBrandingKept'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="admin-page">
      <header><button onClick={onBack}><ArrowLeft /></button><div><h1>{t('globalAdmin')}</h1><p>{t('adminSession')}: {user.username}</p></div></header>
      <section className="stats-grid">
        <div><Users /><strong>{stats?.users ?? '—'}</strong><span>{t('users')}</span></div>
        <div><ServerIcon /><strong>{stats?.servers ?? '—'}</strong><span>{t('servers')}</span></div>
        <div><HardDrive /><strong>{((stats?.uploadBytes || 0) / 1024 ** 2).toFixed(1)} MB</strong><span>{t('uploads')}</span></div>
      </section>
      <div className="admin-grid">
        <section className="panel">
          <h2>{t('users')}</h2>
          {users.map((item) => (
            <div className="user-row" key={item.id}>
              <div className="avatar">{item.username[0]?.toUpperCase()}</div>
              <div><strong>{item.username}</strong><small>{item.isSuperAdmin ? 'super-admin' : item.suspended ? t('suspended') : t('active')}</small></div>
              {item.id !== user.id && <>
                <button title={t('suspendUser')} onClick={async () => { await api(`/admin/users/${item.id}`, { method: 'PATCH', body: JSON.stringify({ suspended: !item.suspended }) }); load(); }}><Ban /></button>
                <button title={t('deleteUser')} onClick={async () => { if (confirm(t('deleteUserConfirm'))) { await api(`/admin/users/${item.id}`, { method: 'DELETE' }); load(); } }}><Trash2 /></button>
              </>}
            </div>
          ))}
        </section>
        <form className="panel" onSubmit={create}>
          <h2>{t('createUser')}</h2>
          <label>{t('username')}<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
          <label>{t('password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <small>{t('passwordHint')}</small>
          <button className="primary"><Plus size={18} /> {t('createAccount')}</button>
        </form>
      </div>
      <section className="panel admin-settings-panel">
        <div>
          <h2>{t('hostingAdminBranding')}</h2>
          <p className="muted">{t('brandingHelp')}</p>
        </div>
        <div className="admin-setting-row">
          <label>{t('defaultLanguage')}
            <select value={defaultLanguage} onChange={(event) => setDefaultLanguage(event.target.value as Language)}>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="fr">Français</option>
            </select>
          </label>
          <button className="secondary-button" onClick={saveDefaultLanguage}>{t('save')}</button>
        </div>
        <div className="branding-grid">
          {[
            { kind: 'site-icon' as const, label: t('siteIcon'), url: siteConfig.siteIconUrl },
            { kind: 'favicon' as const, label: t('siteFavicon'), url: siteConfig.faviconUrl },
            { kind: 'login-background' as const, label: t('loginBackground'), url: siteConfig.loginBackgroundUrl },
          ].map((item) => (
            <div className="branding-item" key={item.kind}>
              <div className={`branding-preview ${item.url ? 'has-image' : ''}`}>
                {item.url ? <img src={item.url} alt={item.label} /> : <Image />}
              </div>
              <strong>{item.label}</strong>
              <div>
                <label className="secondary-button">
                  <Image size={15} /> {t('upload')}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/x-icon" onChange={(event) => event.target.files?.[0] && uploadBranding(item.kind, event.target.files[0])} />
                </label>
                <button className="secondary-button" onClick={() => resetBranding(item.kind)}><RotateCcw size={15} /> {t('resetDefault')}</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel admin-invites">
        <div className="admin-invite-header">
          <div><h2>{t('registrationLinks')}</h2><p>{t('registrationLinksHelp')}</p></div>
          <select value={expiresIn} onChange={(event) => setExpiresIn(event.target.value as typeof expiresIn)}>
            <option value="1h">{t('expires1h')}</option>
            <option value="3d">{t('expires3d')}</option>
            <option value="7d">{t('expires7d')}</option>
            <option value="never">{t('expiresNever')}</option>
          </select>
          <button className="primary" onClick={createInvite}><Link2 /> {t('createAndCopyLink')}</button>
        </div>
        <div className="invite-list">
          {invites.map((invite) => {
            const expired = Boolean(invite.expiresAt && new Date(invite.expiresAt) <= new Date());
            const link = `${window.location.origin}/?register=${invite.token}`;
            return (
              <div className="invite-row" key={invite.id}>
                <Clock />
                <span>
                  <strong>{invite.usedAt ? t('used') : expired ? t('expired') : t('active')}</strong>
                  <small>{invite.expiresAt ? `${t('expires')}: ${new Date(invite.expiresAt).toLocaleString()}` : t('noExpiration')}</small>
                </span>
                {!invite.usedAt && !expired && <button title={t('copyLink')} onClick={() => copyText(link)}><Copy /></button>}
                <button title={t('revoke')} onClick={async () => { await api(`/admin/registration-invites/${invite.id}`, { method: 'DELETE' }); load(); }}><Trash2 /></button>
              </div>
            );
          })}
        </div>
      </section>
      {error && <button className="toast" onClick={() => setError('')}>{error}</button>}
      {notice && <button className="toast success-toast" onClick={() => setNotice('')}>{notice}</button>}
    </div>
  );
}
