import { CalendarDays, Clock3, MessageCircle, UserPlus, X } from 'lucide-react';
import type { User } from '../types';
import { UserAvatar } from './UserAvatar';

export function ProfileModal({
  user,
  onClose,
  onMessage,
  onAddFriend,
}: {
  user: Pick<User, 'id' | 'username' | 'createdAt' | 'avatarUrl' | 'status' | 'bio' | 'customStatus' | 'relationship' | 'serverJoinedAt'>;
  onClose: () => void;
  onMessage?: () => void;
  onAddFriend?: () => void;
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
        {user.customStatus && <div className="profile-custom-status">{user.customStatus}</div>}
        {user.bio && <div className="profile-bio"><strong>Sobre mim</strong><p>{user.bio}</p></div>}
        <div className="profile-dates">
          <div className="profile-meta">
            <CalendarDays size={18} />
            <div>
              <small>Conta criada em</small>
              <strong>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-PT') : 'Data indisponível'}</strong>
            </div>
          </div>
          {user.serverJoinedAt && (
            <div className="profile-meta">
              <Clock3 size={18} />
              <div>
                <small>Entrou neste servidor em</small>
                <strong>{new Date(user.serverJoinedAt).toLocaleDateString('pt-PT')}</strong>
              </div>
            </div>
          )}
        </div>
        <div className="profile-actions">
          {user.relationship === 'friend' && onMessage && (
            <button className="primary" onClick={onMessage}><MessageCircle size={18} /> Enviar mensagem</button>
          )}
          {user.relationship === 'none' && onAddFriend && (
            <button className="primary" onClick={onAddFriend}><UserPlus size={18} /> Adicionar amigo</button>
          )}
          {user.relationship === 'pending' && <button className="primary" disabled>Pedido pendente</button>}
          {user.relationship === 'blocked' && <button className="primary" disabled>Utilizador bloqueado</button>}
        </div>
      </section>
    </div>
  );
}
