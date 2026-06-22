import { Forward, Phone, Reply, Trash2 } from 'lucide-react';
import type { Message, User } from '../types';
import { MessageContent } from './MessageContent';
import { UserAvatar } from './UserAvatar';

export function MessageRow({
  message,
  onReply,
  onForward,
  onProfile,
  authorDisplayName,
  onDelete,
}: {
  message: Message;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onProfile?: (user: Pick<User, 'id' | 'username' | 'avatarUrl' | 'status'>) => void;
  authorDisplayName?: string;
  onDelete?: (message: Message) => void;
}) {
  const callLog = message.content.match(
    /^\[call-log started="([^"]+)" ended="([^"]*)" duration="(\d+)"\]$/,
  );
  if (callLog) {
    const [, startedValue, endedValue, durationValue] = callLog;
    const startedAt = new Date(startedValue!);
    const duration = Number(durationValue);
    const durationLabel = duration < 60
      ? `${duration}s`
      : duration < 3600
        ? `${Math.floor(duration / 60)}m ${duration % 60}s`
        : `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
    return (
      <article className="message call-log-message">
        <div className="call-log-icon"><Phone size={18} /></div>
        <div>
          <strong>{endedValue ? 'Chamada terminada' : 'Chamada iniciada'}</strong>
          <span>
            {startedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            {endedValue ? ` · duração ${durationLabel}` : ' · em curso'}
          </span>
        </div>
      </article>
    );
  }
  return (
    <article className="message">
      <button
        className="message-avatar-button"
        onClick={() => onProfile?.(message.author)}
        disabled={!onProfile}
      >
        <UserAvatar user={message.author} />
      </button>
      <div className="message-body">
        {message.replyTo && (
          <div className="reply-preview">
            <Reply size={13} />
            <strong>@{message.replyTo.author.username}</strong>
            <span>{message.replyTo.content}</span>
          </div>
        )}
        {message.forwardedFrom && (
          <div className="forwarded-label"><Forward size={12} /> Reencaminhada de @{message.forwardedFrom}</div>
        )}
        <button className="username-button" onClick={() => onProfile?.(message.author)}>
          <strong>{authorDisplayName || `@${message.author.username}`}</strong>
        </button>
        <time>{new Date(message.createdAt).toLocaleString('pt-PT')}</time>
        <MessageContent content={message.content} />
      </div>
      <div className="message-actions">
        <button onClick={() => onReply(message)} title="Responder"><Reply size={16} /></button>
        <button onClick={() => onForward(message)} title="Reencaminhar"><Forward size={16} /></button>
        {onDelete && <button onClick={() => onDelete(message)} title="Apagar mensagem"><Trash2 size={16} /></button>}
      </div>
    </article>
  );
}
