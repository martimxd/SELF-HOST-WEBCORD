import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Hash,
  Link2,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Plus,
  Send,
  Settings,
  Shield,
  Users,
  Video,
} from 'lucide-react';
import { api, attachmentMessage, copyText, type UploadedFile } from './api';
import type { Channel, Message, Server, User } from './types';
import { Login } from './components/Login';
import { InitialChange } from './components/InitialChange';
import { Admin } from './components/Admin';
import { CallRoom } from './components/CallRoom';
import { UserSettings } from './components/UserSettings';
import { useI18n } from './i18n';
import { DirectMessages } from './components/DirectMessages';
import { ProfileModal } from './components/ProfileModal';
import { UserAvatar } from './components/UserAvatar';
import { MessageContent } from './components/MessageContent';
import { CreateServer } from './components/CreateServer';

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
  autoConnect: false,
  withCredentials: true,
});

export function App() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null | undefined>();
  const [servers, setServers] = useState<Server[]>([]);
  const [serverId, setServerId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [view, setView] = useState<'chat' | 'admin' | 'settings' | 'dms' | 'create-server'>('chat');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Pick<User, 'id' | 'username' | 'createdAt' | 'avatarUrl' | 'status'> | null>(null);
  const [dmTarget, setDmTarget] = useState('');
  const [notice, setNotice] = useState('');

  const server = servers.find((item) => item.id === serverId);
  const channel = server?.channels.find((item) => item.id === channelId);
  const membership = server?.members.find((item) => item.user.id === user?.id);
  const canCreateChannels = Boolean(
    membership && ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role),
  );

  const loadServers = useCallback(async () => {
    const result = await api<{ servers: Server[] }>('/servers');
    setServers(result.servers);
    const firstServer = result.servers[0];
    setServerId((current) => {
      if (!current && firstServer) {
        setChannelId(firstServer.channels[0]?.id || '');
        return firstServer.id;
      }
      return current;
    });
    return result.servers;
  }, []);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    loadServers().catch((err) => setError(err.message));
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [user?.id, user?.username, user?.mustChangePassword, loadServers]);

  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const params = new URLSearchParams(window.location.search);
    const serverInvite = params.get('serverInvite');
    const friendInvite = params.get('friendInvite');
    if (!serverInvite && !friendInvite) return;

    const acceptInvite = async () => {
      try {
        if (serverInvite) {
          const result = await api<{ server: { id: string; name: string } }>(
            `/invites/server/${encodeURIComponent(serverInvite)}`,
            { method: 'POST' },
          );
          const refreshed = await api<{ servers: Server[] }>('/servers');
          setServers(refreshed.servers);
          const joined = refreshed.servers.find((item) => item.id === result.server.id);
          setServerId(result.server.id);
          setChannelId(joined?.channels[0]?.id || '');
          setView('chat');
          setNotice(`Entrou no servidor ${result.server.name}`);
        } else if (friendInvite) {
          const result = await api<{ friend: User }>(
            `/invites/friend/${encodeURIComponent(friendInvite)}`,
            { method: 'POST' },
          );
          setView('dms');
          setNotice(`@${result.friend.username} foi adicionado aos amigos`);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
      }
    };
    acceptInvite();
  }, [user?.id, user?.mustChangePassword]);

  useEffect(() => {
    const onPresence = ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
      setServers((current) =>
        current.map((item) => ({
          ...item,
          members: item.members.map((member) =>
            member.user.id === userId
              ? { ...member, user: { ...member.user, status } }
              : member,
          ),
        })),
      );
      setUser((current) =>
        current?.id === userId ? { ...current, status } : current,
      );
    };
    const onUserUpdate = (updated: User) => {
      setUser((current) => current?.id === updated.id ? { ...current, ...updated } : current);
      setServers((current) =>
        current.map((item) => ({
          ...item,
          members: item.members.map((member) =>
            member.user.id === updated.id
              ? { ...member, user: { ...member.user, ...updated } }
              : member,
          ),
        })),
      );
      setMessages((current) =>
        current.map((message) =>
          message.author.id === updated.id
            ? { ...message, author: { ...message.author, ...updated } }
            : message,
        ),
      );
    };
    const onServerMemberUpdate = () => loadServers().catch((err) => setError(err.message));
    socket.on('presence:update', onPresence);
    socket.on('user:update', onUserUpdate);
    socket.on('server:member:update', onServerMemberUpdate);
    return () => {
      socket.off('presence:update', onPresence);
      socket.off('user:update', onUserUpdate);
      socket.off('server:member:update', onServerMemberUpdate);
    };
  }, [loadServers]);

  useEffect(() => {
    if (!channelId || channel?.type !== 'TEXT') {
      setMessages([]);
      return;
    }
    api<{ messages: Message[] }>(`/channels/${channelId}/messages`)
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err.message));
    socket.emit('channel:join', channelId);
    const onMessage = (message: Message) => {
      if (message && typeof message === 'object') {
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        );
      }
    };
    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [channelId, channel?.type]);

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      socket.disconnect();
      setServers([]);
      setServerId('');
      setChannelId('');
      setMessages([]);
      setView('chat');
      setUser(null);
    }
  };

  const copyServerInvite = async () => {
    if (!server) return;
    try {
      const result = await api<{ token: string }>(`/servers/${server.id}/invites`, {
        method: 'POST',
      });
      const link = `${window.location.origin}/?serverInvite=${result.token}`;
      await copyText(link);
      setNotice('Link de convite do servidor copiado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const serverCreated = (server: Server) => {
    setServers((current) => [...current, server]);
    setServerId(server.id);
    setChannelId(server.channels[0]?.id || '');
    setView('chat');
  };

  const createChannel = async (type: Channel['type']) => {
    if (!server) return;
    const name = prompt('Nome do canal');
    if (!name) return;
    const { channel } = await api<{ channel: Channel }>(`/servers/${server.id}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    });
    setServers((current) =>
      current.map((item) =>
        item.id === server.id ? { ...item, channels: [...item.channels, channel] } : item,
      ),
    );
    setChannelId(channel.id);
  };

  const showProfile = async (username: string) => {
    try {
      const result = await api<{ user: Pick<User, 'id' | 'username' | 'createdAt' | 'avatarUrl' | 'status'> }>(
        `/users/${encodeURIComponent(username)}/profile`,
      );
      setProfile(result.user);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !channel) return;
    const content = text;
    setText('');
    try {
      await api(`/channels/${channel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    } catch (err) {
      setError((err as Error).message);
      setText(content);
    }
  };

  const upload = async (file: File) => {
    if (!channel) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api<{ upload: UploadedFile }>(
        `/channels/${channel.id}/uploads`,
        { method: 'POST', body: form },
      );
      await api(`/channels/${channel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: attachmentMessage(result.upload) }),
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const initials = useMemo(
    () => (server?.name || 'W').split(/\s+/).map((part) => part[0]).join('').slice(0, 2),
    [server?.name],
  );

  if (user === undefined) return <div className="center-screen">A carregar WebCord…</div>;
  if (!user) return <Login onLogin={setUser} />;
  if (user.mustChangePassword) return <InitialChange onChanged={setUser} />;
  if (view === 'admin') return <Admin user={user} onBack={() => setView('chat')} />;
  if (view === 'settings') return <UserSettings user={user} onUserUpdated={setUser} onLogout={logout} onBack={() => setView('chat')} />;
  if (view === 'create-server') return (
    <CreateServer onBack={() => setView('chat')} onCreated={serverCreated} />
  );
  if (view === 'dms') return (
    <DirectMessages
      currentUser={user}
      socket={socket}
      initialUsername={dmTarget || undefined}
      onBack={() => { setDmTarget(''); setView('chat'); }}
    />
  );

  return (
    <div className={`app-shell ${showMembers && server ? 'with-members' : ''}`}>
      <aside className="server-rail">
        <div className="brand-mark">W</div>
        <button className="server-icon dm-icon" onClick={() => setView('dms')} title="Mensagens diretas">
          <MessageCircle size={21} />
        </button>
        {servers.map((item) => (
          <button
            className={`server-icon ${item.id === serverId ? 'active' : ''}`}
            key={item.id}
            title={item.name}
            onClick={() => {
              setServerId(item.id);
              setChannelId(item.channels[0]?.id || '');
            }}
          >
            {item.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <button className="server-icon add" onClick={() => setView('create-server')} title="Criar servidor">
          <Plus size={20} />
        </button>
      </aside>

      <aside className={`channel-panel ${mobileOpen ? 'mobile-open' : ''}`}>
        <header>
          <div className="server-avatar">{initials}</div>
          <div>
            <strong>{server?.name || 'WebCord'}</strong>
            <small>{server?.description || t('communitySpace')}</small>
          </div>
          {server && <button className="server-invite-button" onClick={copyServerInvite} title="Copiar link de convite"><Link2 size={17} /></button>}
        </header>
        <div className="section-title">
          <span>{t('channels')}</span>
          {server && canCreateChannels && (
            <div className="channel-create-actions">
              <button onClick={() => createChannel('TEXT')} title="Criar canal de texto"><Hash size={15} /></button>
              <button onClick={() => createChannel('VOICE')} title="Criar canal de voz"><Mic size={15} /></button>
              <button onClick={() => createChannel('VIDEO')} title="Criar canal de vídeo"><Video size={15} /></button>
            </div>
          )}
        </div>
        <nav>
          {server?.channels.map((item) => (
            <button
              key={item.id}
              className={item.id === channelId ? 'active' : ''}
              onClick={() => {
                setChannelId(item.id);
                setMobileOpen(false);
              }}
            >
              {item.type === 'TEXT' ? <Hash size={18} /> : item.type === 'VIDEO' ? <Video size={18} /> : <Mic size={18} />}
              {item.name}
            </button>
          ))}
        </nav>
        <div className="user-dock">
          <button className="avatar-button" onClick={() => showProfile(user.username)}><UserAvatar user={user} /></button>
          <div><button className="username-button" onClick={() => showProfile(user.username)}><strong>{user.username}</strong></button><small>{user.status === 'offline' ? 'offline' : 'online'}</small></div>
          {user.isSuperAdmin && <button title="Administração" onClick={() => setView('admin')}><Shield size={17} /></button>}
          <button title={t('settings')} onClick={() => setView('settings')}><Settings size={17} /></button>
          <button title={t('logout')} onClick={logout}><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}><Menu /></button>
          {channel?.type === 'TEXT' ? <Hash /> : <Mic />}
          <strong>{channel?.name || 'Bem-vindo'}</strong>
          <span>{channel?.type === 'TEXT' ? t('communityChat') : t('callRoom')}</span>
          <button className="members-toggle push-right" onClick={() => setShowMembers((current) => !current)} title="Membros"><Users /></button>
        </header>

        {!server ? (
          <div className="empty-state">
            <MessageCircle size={54} />
            <h1>{t('createFirstServer')}</h1>
            <p>{t('createFirstServerText')}</p>
            <button className="primary" onClick={() => setView('create-server')}>{t('createServer')}</button>
          </div>
        ) : channel?.type !== 'TEXT' ? (
          channel && (
            <CallRoom
              name={channel.name}
              tokenEndpoint={`/channels/${channel.id}/call-token`}
              videoEnabled={channel.type === 'VIDEO'}
            />
          )
        ) : (
          <>
            <section className="messages">
              <div className="channel-intro">
                <div><Hash size={30} /></div>
                <h1>#{channel.name}</h1>
                <p>{t('welcomeChannel')}</p>
              </div>
              {messages.map((message) => (
                <article className="message" key={message.id}>
                  <UserAvatar user={message.author} />
                  <div>
                    <button className="username-button" onClick={() => showProfile(message.author.username)}><strong>{message.author.username}</strong></button>
                    <time>{new Date(message.createdAt).toLocaleString('pt-PT')}</time>
                    <MessageContent content={message.content} />
                  </div>
                </article>
              ))}
            </section>
            <form className="composer" onSubmit={send}>
              <label className="attach" title="Enviar ficheiro">
                <Plus />
                <input type="file" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
              </label>
              <input
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  socket.emit('typing', channelId);
                }}
                placeholder={`${t('messageTo')} #${channel.name}`}
              />
              <button type="submit"><Send size={20} /></button>
            </form>
          </>
        )}
        {error && <button className="toast" onClick={() => setError('')}>{error}</button>}
        {notice && <button className="toast success-toast" onClick={() => setNotice('')}>{notice}</button>}
      </main>
      {showMembers && server && (
        <aside className="member-panel">
          <header><strong>Membros</strong><span>{server.members.length}</span></header>
          <div className="member-list">
            {server.members
              .slice()
              .sort((a, b) => Number(b.user.status === 'online') - Number(a.user.status === 'online'))
              .map((member) => (
                <button key={member.id} onClick={() => showProfile(member.user.username)}>
                  <UserAvatar user={member.user} />
                  <span>
                    <strong>@{member.user.username}</strong>
                    <small>{member.user.status === 'online' ? 'Online' : 'Offline'} · {member.role.toLowerCase()}</small>
                  </span>
                </button>
              ))}
          </div>
        </aside>
      )}
      {profile && (
        <ProfileModal
          user={profile}
          onClose={() => setProfile(null)}
          onMessage={profile.id !== user.id ? () => { setDmTarget(profile.username); setProfile(null); setView('dms'); } : undefined}
        />
      )}
    </div>
  );
}
