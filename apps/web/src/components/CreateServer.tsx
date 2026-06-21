import { useState } from 'react';
import { ArrowLeft, Hash, Sparkles, Users } from 'lucide-react';
import { api } from '../api';
import type { Server } from '../types';

export function CreateServer({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (server: Server) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await api<{ server: Server }>('/servers', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      onCreated(result.server);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-server-page">
      <button className="create-server-back" onClick={onBack}><ArrowLeft /> Voltar</button>
      <main className="create-server-card">
        <div className="create-server-art">
          <Sparkles size={30} />
          <h1>Cria o teu espaço</h1>
          <p>Todos os utilizadores podem criar servidores. Começas com um canal #geral e controlo total sobre a comunidade.</p>
          <div className="server-feature"><Hash /><span>Canal de texto criado automaticamente</span></div>
          <div className="server-feature"><Users /><span>Convida e organiza a tua comunidade</span></div>
        </div>
        <form className="create-server-form" onSubmit={submit}>
          <span className="eyebrow">NOVO SERVIDOR</span>
          <h2>Como se chama?</h2>
          <p>Podes alterar estes detalhes mais tarde.</p>
          <label>
            Nome do servidor
            <input
              autoFocus
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="A minha comunidade"
            />
          </label>
          <label>
            Descrição
            <textarea
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Sobre o que vão falar neste servidor?"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary" disabled={submitting || name.trim().length < 2}>
            {submitting ? 'A criar…' : 'Criar servidor'}
          </button>
        </form>
      </main>
    </div>
  );
}
