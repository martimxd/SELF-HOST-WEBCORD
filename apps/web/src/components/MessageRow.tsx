import { Forward, Reply } from 'lucide-react';
import type { Message, User } from '../types';
import { MessageContent } from './MessageContent';
import { UserAvatar } from './UserAvatar';

export function MessageRow({
  message,
  onReply,
  onForward,
  onProfile,
}: {
  message: Message;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onProfile?: (user: Pick<User, 'id' | 'username' | 'avatarUrl' | 'status'>) => void;
}) {
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
          <strong>@{message.author.username}</strong>
        </button>
        <time>{new Date(message.createdAt).toLocaleString('pt-PT')}</time>
        <MessageContent content={message.content} />
      </div>
      <div className="message-actions">
        <button onClick={() => onReply(message)} title="Responder"><Reply size={16} /></button>
        <button onClick={() => onForward(message)} title="Reencaminhar"><Forward size={16} /></button>
      </div>
    </article>
  );
}
