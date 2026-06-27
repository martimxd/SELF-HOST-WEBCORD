import { Forward, Heart, Phone, Reply, Trash2 } from 'lucide-react';
import type { Message, User } from '../types';
import { MessageContent } from './MessageContent';
import { UserAvatar } from './UserAvatar';
import { useI18n } from '../i18n';

function smallHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function extractGifFavorite(content: string) {
  const rich = content.match(/^\[giphy id="([^"]+)" title="([^"]*)"\]\n(https?:\/\/[^\s]+)$/);
  if (rich?.[1] && rich[3]) {
    let title = 'GIF';
    try {
      title = rich[2] ? decodeURIComponent(rich[2]) : 'GIF';
    } catch {
      title = 'GIF';
    }
    return {
      gifId: rich[1],
      title,
      url: rich[3],
      previewUrl: rich[3],
      source: 'giphy',
    };
  }
  const url = content.match(/https?:\/\/[^\s]+\.gif(?:\?[^\s]*)?/i)?.[0];
  if (!url) return null;
  return {
    gifId: `url-${smallHash(url)}`,
    title: 'GIF',
    url,
    previewUrl: url,
    source: 'url',
  };
}

export function MessageRow({
  message,
  onReply,
  onForward,
  onProfile,
  authorDisplayName,
  onDelete,
  onFavoriteGif,
}: {
  message: Message;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onProfile?: (user: Pick<User, 'id' | 'username' | 'avatarUrl' | 'status'>) => void;
  authorDisplayName?: string;
  onDelete?: (message: Message) => void;
  onFavoriteGif?: (gif: NonNullable<ReturnType<typeof extractGifFavorite>>) => void;
}) {
  const { t } = useI18n();
  const gifFavorite = extractGifFavorite(message.content);
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
          <strong>{endedValue ? t('callEnded') : t('callStarted')}</strong>
          <span>
            {startedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            {endedValue ? ` · ${durationLabel}` : ` · ${t('callInProgress')}`}
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
        <button onClick={() => onReply(message)} title={t('reply')}><Reply size={16} /></button>
        <button onClick={() => onForward(message)} title={t('forward')}><Forward size={16} /></button>
        {gifFavorite && onFavoriteGif && (
          <button onClick={() => onFavoriteGif(gifFavorite)} title={t('favoriteGif')}><Heart size={16} /></button>
        )}
        {onDelete && <button onClick={() => onDelete(message)} title={t('deleteMessage')}><Trash2 size={16} /></button>}
      </div>
    </article>
  );
}
