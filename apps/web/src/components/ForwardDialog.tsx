import { Hash, MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DirectConversation, Message } from '../types';

type ForwardTargets = {
  servers: Array<{
    id: string;
    name: string;
    channels: Array<{ id: string; name: string }>;
  }>;
  conversations: DirectConversation[];
};

export function ForwardDialog({
  message,
  sourceType,
  onClose,
  onForwarded,
}: {
  message: Message;
  sourceType: 'channel' | 'direct';
  onClose: () => void;
  onForwarded: () => void;
}) {
  const [targets, setTargets] = useState<ForwardTargets>({ servers: [], conversations: [] });
  const [error, setError] = useState('');
  const [sending, setSending] = useState('');

  useEffect(() => {
    api<ForwardTargets>('/forward-targets')
      .then(setTargets)
      .catch((err) => setError(err.message));
  }, []);

  const forward = async (targetType: 'channel' | 'direct', targetId: string) => {
    setSending(`${targetType}:${targetId}`);
    try {
      await api('/messages/forward', {
        method: 'POST',
        body: JSON.stringify({
          sourceType,
          sourceMessageId: message.id,
          targetType,
          targetId,
        }),
      });
      onForwarded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending('');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="dialog-card forward-dialog" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>
        <span className="eyebrow">REENCAMINHAR</span>
        <h2>Escolhe o destino</h2>
        <div className="forward-source"><strong>@{message.author.username}</strong><span>{message.content}</span></div>
        {targets.conversations.length > 0 && <h3>Mensagens privadas</h3>}
        <div className="dialog-list">
          {targets.conversations.map((conversation) => (
            <button
              key={conversation.id}
              disabled={Boolean(sending)}
              onClick={() => forward('direct', conversation.id)}
            >
              <MessageCircle />
              <span><strong>{conversation.isGroup ? conversation.name : `@${conversation.otherUser?.username}`}</strong><small>Mensagem privada</small></span>
            </button>
          ))}
        </div>
        {targets.servers.map((server) => (
          <div key={server.id}>
            <h3>{server.name}</h3>
            <div className="dialog-list compact-list">
              {server.channels.map((channel) => (
                <button
                  key={channel.id}
                  disabled={Boolean(sending)}
                  onClick={() => forward('channel', channel.id)}
                >
                  <Hash />
                  <strong>{channel.name}</strong>
                </button>
              ))}
            </div>
          </div>
        ))}
        {error && <div className="form-error">{error}</div>}
      </section>
    </div>
  );
}
