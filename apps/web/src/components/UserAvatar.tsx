import { API_URL } from '../api';
import type { User } from '../types';

export function UserAvatar({
  user,
  className = 'avatar',
}: {
  user: Pick<User, 'username' | 'avatarUrl' | 'status'>;
  className?: string;
}) {
  return (
    <div className={`${className} ${user.avatarUrl ? 'has-image' : ''}`}>
      {user.avatarUrl
        ? <img src={`${API_URL}${user.avatarUrl}`} alt={`Avatar de ${user.username}`} />
        : user.username[0]?.toUpperCase()}
      {'status' in user && <span className={`presence-dot ${user.status === 'online' ? 'online' : ''}`} />}
    </div>
  );
}
