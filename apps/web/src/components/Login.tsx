import { useEffect, useState } from 'react';
import { Info, MessageCircle } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';
import { LanguageSelect, useI18n } from '../i18n';

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [initialAccount, setInitialAccount] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{
      showInitialCredentials: boolean;
      initialAccount: { username: string; password: string } | null;
    }>('/auth/install-state')
      .then((result) => {
        setInitialAccount(result.showInitialCredentials ? result.initialAccount : null);
      })
      .catch(() => setInitialAccount(null));
  }, []);

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
        {initialAccount && (
          <div className="initial-account-notice">
            <Info size={15} />
            <span>{t('initialAccountNotice')} <code>{initialAccount.username} / {initialAccount.password}</code></span>
          </div>
        )}
        <label>{t('username')}<input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus /></label>
        <label>{t('password')}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? t('loggingIn') : t('login')}</button>
        <div className="login-credit">
          <small><Info size={13} /> {t('uploadCompressed')}</small>
          <a href="https://www.youtube.com/@MartimTech-s5b" target="_blank" rel="noreferrer">
            {t('projectCredit')}
          </a>
        </div>
      </form>
    </div>
  );
}
