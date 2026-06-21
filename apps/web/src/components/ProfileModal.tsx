import { CalendarDays, MessageCircle, X } from 'lucide-react';
import type { User } from '../types';
import { UserAvatar } from './UserAvatar';

export function ProfileModal({
  user,
  onClose,
  onMessage,
}: {
  user: Pick<User, 'id' | 'username' | 'createdAt' | 'avatarUrl' | 'status'>;
  onClose: () => void;
  onMessage?: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="profile-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>
        <div className="profile-banner" />
        <UserAvatar user={user} className="profile-avatar" />
        <h2>@{user.username}</h2>
        <div className={`profile-status ${user.status === 'online' ? 'online' : ''}`}>
          <span /> {user.status === 'online' ? 'Online' : 'Offline'}
        </div>
        <div className="profile-meta">
          <CalendarDays size={18} />
          <div>
            <small>Conta criada em</small>
            <strong>
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Data indisponível'}
            </strong>
          </div>
        </div>
        {onMessage && <button className="primary" onClick={onMessage}><MessageCircle size={18} /> Enviar mensagem</button>}
      </section>
    </div>
  );
}
