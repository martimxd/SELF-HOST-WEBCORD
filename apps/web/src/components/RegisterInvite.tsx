import { KeyRound, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { User } from '../types';

export function RegisterInvite({
  token,
  onRegistered,
}: {
  token: string;
  onRegistered: (user: User) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    api<{ valid: true; expiresAt: string | null }>(`/registration-invites/${encodeURIComponent(token)}`)
      .then((result) => setExpiresAt(result.expiresAt))
      .catch((err) => setError(err.message))
      .finally(() => setValidating(false));
  }, [token]);

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const result = await api<{ user: User }>(
        `/registration-invites/${encodeURIComponent(token)}/register`,
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
      );
      window.history.replaceState({}, '', window.location.pathname);
      onRegistered(result.user);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="invite-register-page">
      <form className="auth-card compact invite-register-card" onSubmit={register}>
        <div className="call-icon"><KeyRound /></div>
        <span className="eyebrow">CONVITE PRIVADO</span>
        <h2>Criar conta WebCord</h2>
        <p>
          Este link foi criado pelo administrador.
          {expiresAt ? ` Expira em ${new Date(expiresAt).toLocaleString('pt-PT')}.` : ' Não expira.'}
        </p>
        <label>Username<input required minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>Password<input required type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <small>Usa 10+ caracteres com maiúscula, minúscula, número e símbolo.</small>
        <button className="primary" disabled={validating || Boolean(error && !username)}><UserPlus /> Criar a minha conta</button>
        {error && <div className="form-error">{error}</div>}
      </form>
    </div>
  );
}
