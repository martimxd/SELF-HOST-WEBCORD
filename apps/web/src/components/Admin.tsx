import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, HardDrive, Plus, Server as ServerIcon, Trash2, Users } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';

type Stats = { users: number; servers: number; channels: number; uploadBytes: number };

export function Admin({ user, onBack }: { user: User; onBack: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const load = () => {
    api<{ users: User[] }>('/admin/users').then((result) => setUsers(result.users));
    api<Stats>('/admin/stats').then(setStats);
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
    </div>
  );
}
