import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, Clock, Copy, HardDrive, Link2, Plus, Server as ServerIcon, Trash2, Users } from 'lucide-react';
import { api, copyText } from '../api';
import type { User } from '../types';

type Stats = { users: number; servers: number; channels: number; uploadBytes: number };
type RegistrationInvite = {
  id: string;
  token: string;
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
};

export function Admin({ user, onBack }: { user: User; onBack: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invites, setInvites] = useState<RegistrationInvite[]>([]);
  const [expiresIn, setExpiresIn] = useState<'1h' | '3d' | '7d' | 'never'>('7d');
  const [notice, setNotice] = useState('');
  const load = () => {
    api<{ users: User[] }>('/admin/users').then((result) => setUsers(result.users));
    api<Stats>('/admin/stats').then(setStats);
    api<{ invites: RegistrationInvite[] }>('/admin/registration-invites').then((result) => setInvites(result.invites));
  };

  const createInvite = async () => {
    const result = await api<{ invite: RegistrationInvite }>('/admin/registration-invites', {
      method: 'POST',
      body: JSON.stringify({ expiresIn }),
    });
    const link = `${window.location.origin}/?register=${result.invite.token}`;
    await copyText(link);
    setNotice('Link de registo criado e copiado');
    setInvites((items) => [result.invite, ...items]);
  };
  useEffect(load, []);

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

  return (
    <div className="admin-page">
      <header><button onClick={onBack}><ArrowLeft /></button><div><h1>Administração global</h1><p>Sessão: {user.username}</p></div></header>
      <section className="stats-grid">
        <div><Users /><strong>{stats?.users ?? '—'}</strong><span>Utilizadores</span></div>
        <div><ServerIcon /><strong>{stats?.servers ?? '—'}</strong><span>Servidores</span></div>
        <div><HardDrive /><strong>{((stats?.uploadBytes || 0) / 1024 ** 2).toFixed(1)} MB</strong><span>Uploads</span></div>
      </section>
      <div className="admin-grid">
        <section className="panel">
          <h2>Utilizadores</h2>
          {users.map((item) => (
            <div className="user-row" key={item.id}>
              <div className="avatar">{item.username[0]?.toUpperCase()}</div>
              <div><strong>{item.username}</strong><small>{item.isSuperAdmin ? 'super-admin' : item.suspended ? 'suspenso' : 'ativo'}</small></div>
              {item.id !== user.id && <>
                <button title="Suspender" onClick={async () => { await api(`/admin/users/${item.id}`, { method: 'PATCH', body: JSON.stringify({ suspended: !item.suspended }) }); load(); }}><Ban /></button>
                <button title="Apagar" onClick={async () => { if (confirm('Apagar utilizador?')) { await api(`/admin/users/${item.id}`, { method: 'DELETE' }); load(); } }}><Trash2 /></button>
              </>}
            </div>
          ))}
        </section>
        <form className="panel" onSubmit={create}>
          <h2>Criar utilizador</h2>
          <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <small>10+ caracteres, maiúscula, minúscula, número e símbolo.</small>
          <button className="primary"><Plus size={18} /> Criar conta</button>
        </form>
      </div>
      <section className="panel admin-invites">
        <div className="admin-invite-header">
          <div><h2>Links de registo</h2><p>Só o super-admin pode criar links para novas contas. Cada link pode ser usado uma vez.</p></div>
          <select value={expiresIn} onChange={(event) => setExpiresIn(event.target.value as typeof expiresIn)}>
            <option value="1h">Expira em 1 hora</option>
            <option value="3d">Expira em 3 dias</option>
            <option value="7d">Expira em 7 dias</option>
            <option value="never">Sem expiração</option>
          </select>
          <button className="primary" onClick={createInvite}><Link2 /> Criar e copiar link</button>
        </div>
        <div className="invite-list">
          {invites.map((invite) => {
            const expired = Boolean(invite.expiresAt && new Date(invite.expiresAt) <= new Date());
            const link = `${window.location.origin}/?register=${invite.token}`;
            return (
              <div className="invite-row" key={invite.id}>
                <Clock />
                <span>
                  <strong>{invite.usedAt ? 'Utilizado' : expired ? 'Expirado' : 'Ativo'}</strong>
                  <small>{invite.expiresAt ? `Expira: ${new Date(invite.expiresAt).toLocaleString('pt-PT')}` : 'Sem expiração'}</small>
                </span>
                {!invite.usedAt && !expired && <button title="Copiar link" onClick={() => copyText(link)}><Copy /></button>}
                <button title="Revogar" onClick={async () => { await api(`/admin/registration-invites/${invite.id}`, { method: 'DELETE' }); load(); }}><Trash2 /></button>
              </div>
            );
          })}
        </div>
      </section>
      {notice && <button className="toast success-toast" onClick={() => setNotice('')}>{notice}</button>}
    </div>
  );
}
