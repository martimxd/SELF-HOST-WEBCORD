import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';
import { useI18n } from '../i18n';
import { initialChangeSchema } from '@webcord/shared';

export function InitialChange({ onChanged }: { onChanged: (user: User) => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = initialChangeSchema.safeParse({ username, password });
    if (!validation.success) {
      setError([...new Set(validation.error.issues.map((issue) => issue.message))].join('. '));
      return;
    }
    try {
      const result = await api<{ user: User }>('/auth/initial-change', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onChanged(result.user);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="center-screen">
      <form className="auth-card compact" onSubmit={submit}>
        <KeyRound size={40} />
        <h2>{t('protectAccount')}</h2>
        <p>{t('protectAccountText')}</p>
        <label>{t('newUsername')}<input minLength={3} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>{t('newPassword')}<input type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <small>{t('passwordHint')}</small>
        {error && <div className="form-error">{error}</div>}
        <button className="primary">{t('saveContinue')}</button>
      </form>
    </div>
  );
}
