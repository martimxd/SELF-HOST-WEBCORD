import { useEffect, useState } from 'react';
import { AlignLeft, ArrowLeft, AtSign, Camera, Globe2, LogOut, MessageSquareText, Save, Trash2 } from 'lucide-react';
import { LanguageSelect, useI18n } from '../i18n';
import type { User } from '../types';
import { api } from '../api';
import { UserAvatar } from './UserAvatar';

export function UserSettings({
  user,
  onBack,
  onUserUpdated,
  onLogout,
}: {
  user: User;
  onBack: () => void;
  onUserUpdated: (user: User) => void;
  onLogout: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || '');
  const [customStatus, setCustomStatus] = useState(user.customStatus || '');
  const [notice, setNotice] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const uploadAvatar = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api<{ user: User }>('/users/me/avatar', {
        method: 'POST',
        body: form,
      });
      onUserUpdated(result.user);
      setPreview('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeAvatar = async () => {
    const result = await api<{ user: User }>('/users/me/avatar', { method: 'DELETE' });
    onUserUpdated(result.user);
  };

  const updatePresence = async (mode: 'ONLINE' | 'INVISIBLE') => {
    const result = await api<{ user: User }>('/users/me/presence', {
      method: 'PUT',
      body: JSON.stringify({ mode }),
    });
    onUserUpdated(result.user);
  };

  const updateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const result = await api<{ user: User }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ username, bio, customStatus }),
      });
      onUserUpdated(result.user);
      setNotice('Perfil atualizado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deletePassword || !confirm('Apagar permanentemente a tua conta? Esta ação não pode ser anulada.')) return;
    setDeletingAccount(true);
    setError('');
    try {
      await api('/users/me', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      await onLogout();
    } catch (err) {
      setError((err as Error).message);
      setDeletingAccount(false);
    }
  };

  return (
    <div className="admin-page settings-page">
      <header>
        <button onClick={onBack}><ArrowLeft /></button>
        <div><h1>{t('settings')}</h1><p>WebCord</p></div>
      </header>
      <section className="panel settings-panel">
        <Globe2 size={34} />
        <div>
          <h2>{t('language')}</h2>
          <p>Português · English · Français</p>
        </div>
        <LanguageSelect />
      </section>
      <form className="profile-settings-form" onSubmit={updateProfile}>
      <section className="panel settings-panel username-settings">
        <AtSign size={34} />
        <div>
          <h2>Username</h2>
          <p>Usa entre 3 e 32 caracteres: letras, números, ponto, hífen ou underscore.</p>
        </div>
        <div className="username-setting-control">
          <input minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>
      </section>
      <section className="panel settings-panel profile-text-setting">
        <MessageSquareText size={34} />
        <div><h2>Status personalizado</h2><p>Uma frase curta apresentada no teu perfil.</p></div>
        <input maxLength={80} value={customStatus} onChange={(event) => setCustomStatus(event.target.value)} placeholder="O que estás a fazer?" />
      </section>
      <section className="panel settings-panel profile-text-setting bio-setting">
        <AlignLeft size={34} />
        <div><h2>Bio</h2><p>Conta algo sobre ti. Máximo de 400 caracteres.</p></div>
        <div className="bio-control">
          <textarea maxLength={400} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Escreve a tua bio…" />
          <small>{bio.length}/400</small>
        </div>
      </section>
      <button className="primary profile-save" disabled={username === user.username && bio === (user.bio || '') && customStatus === (user.customStatus || '')}><Save size={17} /> Guardar perfil</button>
      </form>
      <section className="panel avatar-settings">
        {preview
          ? <div className="profile-avatar has-image"><img src={preview} alt="Pré-visualização" /></div>
          : <UserAvatar user={user} className="profile-avatar" />}
        <div><h2>Fotografia de perfil</h2><p>Escolhe a tua imagem em JPG, PNG, WebP, GIF ou AVIF. Máximo 10 MB.</p></div>
        <label className="primary avatar-upload"><Camera size={18} /> Escolher imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => event.target.files?.[0] && uploadAvatar(event.target.files[0])} /></label>
        {user.avatarUrl && <button className="danger-button" onClick={removeAvatar}><Trash2 size={18} /> Remover</button>}
      </section>
      <section className="panel settings-panel presence-settings">
        <div className={`presence-preview ${user.presenceMode === 'INVISIBLE' ? '' : 'online'}`} />
        <div><h2>Estado online</h2><p>O modo invisível mostra a tua conta como offline para todos.</p></div>
        <select value={user.presenceMode || 'ONLINE'} onChange={(event) => updatePresence(event.target.value as 'ONLINE' | 'INVISIBLE')}>
          <option value="ONLINE">Online</option>
          <option value="INVISIBLE">Invisível (offline)</option>
        </select>
      </section>
      <section className="panel settings-panel logout-settings">
        <LogOut size={34} />
        <div><h2>Sair da conta</h2><p>Termina a sessão neste dispositivo e volta ao ecrã de login.</p></div>
        <button className="danger-button" onClick={onLogout}><LogOut size={18} /> Terminar sessão</button>
      </section>
      {!user.isSuperAdmin && (
        <form className="panel settings-panel delete-account-settings" onSubmit={deleteAccount}>
          <Trash2 size={34} />
          <div>
            <h2>Apagar conta</h2>
            <p>Os teus dados pessoais serão removidos. Confirma com a tua palavra-passe.</p>
          </div>
          <div className="danger-confirm-control">
            <input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="Palavra-passe"
              autoComplete="current-password"
            />
            <button className="danger-button" disabled={!deletePassword || deletingAccount}>
              <Trash2 size={17} /> {deletingAccount ? 'A apagar…' : 'Apagar conta'}
            </button>
          </div>
        </form>
      )}
      {error && <div className="form-error settings-error">{error}</div>}
      {notice && <button className="toast success-toast" onClick={() => setNotice('')}>{notice}</button>}
    </div>
  );
}
