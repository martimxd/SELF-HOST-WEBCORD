import { FileText, Image, Link2, MessageSquareText, Search, Video, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Message } from '../types';
import { MessageRow } from './MessageRow';

const categories = [
  { id: 'messages', label: 'Mensagens', icon: MessageSquareText },
  { id: 'images', label: 'Imagens', icon: Image },
  { id: 'videos', label: 'Vídeos', icon: Video },
  { id: 'files', label: 'Ficheiros', icon: FileText },
  { id: 'links', label: 'Links', icon: Link2 },
] as const;

export function SearchPanel({
  endpoint,
  onClose,
  onReply,
  onForward,
}: {
  endpoint: string;
  onClose: () => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]['id']>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<{ messages: Message[] }>(
        `${endpoint}?q=${encodeURIComponent(query)}&category=${category}`,
      );
      setMessages(result.messages);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
  }, [endpoint, category]);

  return (
    <aside className="search-panel">
      <header><strong>Pesquisar</strong><button onClick={onClose}><X /></button></header>
      <form className="search-input" onSubmit={(event) => { event.preventDefault(); search(); }}>
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar neste local" />
      </form>
      <div className="search-categories">
        {categories.map(({ id, label, icon: Icon }) => (
          <button className={category === id ? 'active' : ''} key={id} onClick={() => setCategory(id)}>
            <Icon /> {label}
          </button>
        ))}
      </div>
      <div className="search-results">
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} onReply={onReply} onForward={onForward} />
        ))}
        {!loading && !messages.length && <p>Nenhum resultado.</p>}
        {loading && <p>A pesquisar…</p>}
        {error && <div className="form-error">{error}</div>}
      </div>
    </aside>
  );
}
