import { useState } from 'react';
import { Info, MessageCircle } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';
import { LanguageSelect, useI18n } from '../i18n';

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLogin(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="orbit one" />
        <div className="orbit two" />
        <MessageCircle size={72} />
        <h1>{t('ownedConversations')}</h1>
        <p>{t('openPlatform')}</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="brand"><span>W</span> WebCord</div>
        <LanguageSelect />
        <h2>{t('welcome')}</h2>
        <p>{t('loginSubtitle')}</p>
        <label>{t('username')}<input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></label>
        <label>{t('password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? t('loggingIn') : t('login')}</button>
        <div className="login-credit">
          <small><Info size={13} /> {t('firstInstall')}</small>
          <a href="https://www.youtube.com/@martimxd" target="_blank" rel="noreferrer">
            {t('projectCredit')}
          </a>
        </div>
      </form>
    </div>
  );
}
