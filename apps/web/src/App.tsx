import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Camera,
  Hash,
  Image,
  Link2,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sticker,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { API_URL, api, attachmentMessage, copyText, type UploadedFile } from './api';
import type { Channel, Message, MessagePage, Server, User } from './types';
import { Login } from './components/Login';
import { InitialChange } from './components/InitialChange';
import { Admin } from './components/Admin';
import { CallRoom } from './components/CallRoom';
import { UserSettings } from './components/UserSettings';
import { useI18n } from './i18n';
import { DirectMessages } from './components/DirectMessages';
import { ProfileModal } from './components/ProfileModal';
import { UserAvatar } from './components/UserAvatar';
import { CreateServer } from './components/CreateServer';
import { MessageRow } from './components/MessageRow';
import { ForwardDialog } from './components/ForwardDialog';
import { MediaPicker } from './components/MediaPicker';
import { RegisterInvite } from './components/RegisterInvite';
import { SearchPanel } from './components/SearchPanel';
import { enableNotificationSound, playDirectMessageSound } from './notifications';

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
  const [profile, setProfile] = useState<User | null>(null);
  const [dmTarget, setDmTarget] = useState('');
  const [notice, setNotice] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [mediaPicker, setMediaPicker] = useState<'gifs' | 'stickers' | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [dmUnread, setDmUnread] = useState<Record<string, number>>({});
  const [activeDirectConversationId, setActiveDirectConversationId] = useState('');
  const messagesRef = useRef<HTMLElement>(null);
  const registrationToken = new URLSearchParams(window.location.search).get('register');

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
    const enable = () => { void enableNotificationSound(); };
    window.addEventListener('pointerdown', enable, { once: true });
    window.addEventListener('keydown', enable, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
    };
  }, []);

  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const onDirectNotification = (message: Message) => {
      if (!message.conversationId || message.author.id === user.id) return;
      void playDirectMessageSound();
      const isReadingConversation = view === 'dms'
        && activeDirectConversationId === message.conversationId
        && document.visibilityState === 'visible';
      if (!isReadingConversation) {
        setDmUnread((current) => ({
          ...current,
          [message.conversationId!]: (current[message.conversationId!] ?? 0) + 1,
        }));
      }
    };
    socket.on('dm:notification', onDirectNotification);
    return () => {
      socket.off('dm:notification', onDirectNotification);
    };
  }, [activeDirectConversationId, user?.id, user?.mustChangePassword, view]);

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
    const onServerUpdate = ({ serverId: updatedServerId, imageUrl }: { serverId: string; imageUrl: string | null }) => {
      setServers((current) =>
        current.map((item) => item.id === updatedServerId ? { ...item, imageUrl } : item),
      );
    };
    socket.on('presence:update', onPresence);
    socket.on('user:update', onUserUpdate);
    socket.on('server:member:update', onServerMemberUpdate);
    socket.on('server:update', onServerUpdate);
    return () => {
      socket.off('presence:update', onPresence);
      socket.off('user:update', onUserUpdate);
      socket.off('server:member:update', onServerMemberUpdate);
      socket.off('server:update', onServerUpdate);
    };
  }, [loadServers]);

  useEffect(() => {
    if (!channelId || channel?.type !== 'TEXT') {
      setMessages([]);
      setMessageCursor(null);
      setReplyingTo(null);
      setMediaPicker(null);
      setSearchOpen(false);
      return;
    }
    api<MessagePage>(`/channels/${channelId}/messages`)
      .then((data) => {
        setMessages(data.messages);
        setMessageCursor(data.nextCursor);
        requestAnimationFrame(() => {
          if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        });
      })
      .catch((err) => setError(err.message));
    socket.emit('channel:join', channelId);
    const onMessage = (message: Message) => {
      if (message && typeof message === 'object' && message.channelId === channelId) {
        const shouldFollow = !messagesRef.current
          || messagesRef.current.scrollHeight - messagesRef.current.scrollTop - messagesRef.current.clientHeight < 140;
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        );
        if (shouldFollow) {
          requestAnimationFrame(() => {
            if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
          });
        }
      }
    };
    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [channelId, channel?.type]);

  const loadOlderMessages = async () => {
    if (!channelId || !messageCursor || loadingOlder) return;
    const container = messagesRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const data = await api<MessagePage>(
        `/channels/${channelId}/messages?cursor=${encodeURIComponent(messageCursor)}`,
      );
      setMessages((current) => [...data.messages, ...current]);
      setMessageCursor(data.nextCursor);
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    if (serverId) socket.emit('server:join', serverId);
  }, [serverId]);

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

  const uploadServerImage = async (file: File) => {
    if (!server) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api<{ imageUrl: string }>(`/servers/${server.id}/image`, {
        method: 'POST',
        body: form,
      });
      setServers((current) =>
        current.map((item) => item.id === server.id ? { ...item, imageUrl: result.imageUrl } : item),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeServerImage = async () => {
    if (!server) return;
    await api(`/servers/${server.id}/image`, { method: 'DELETE' });
    setServers((current) =>
      current.map((item) => item.id === server.id ? { ...item, imageUrl: null } : item),
    );
  };

  const showProfile = async (username: string, serverJoinedAt?: string) => {
    try {
      const result = await api<{ user: User }>(
        `/users/${encodeURIComponent(username)}/profile`,
      );
      setProfile({ ...result.user, serverJoinedAt });
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
        body: JSON.stringify({ content, replyToId: replyingTo?.id }),
      });
      setReplyingTo(null);
    } catch (err) {
      setError((err as Error).message);
      setText(content);
    }
  };

  const sendRichContent = async (content: string) => {
    if (!channel) return;
    await api(`/channels/${channel.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId: replyingTo?.id }),
    });
    setReplyingTo(null);
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

  if (registrationToken && !user) {
    return <RegisterInvite token={registrationToken} onRegistered={setUser} />;
  }
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
      unreadCounts={dmUnread}
      onConversationRead={(conversationId) => {
        setDmUnread((current) => {
          if (!current[conversationId]) return current;
          const next = { ...current };
          delete next[conversationId];
          return next;
        });
      }}
      onActiveConversationChange={setActiveDirectConversationId}
      onBack={() => { setDmTarget(''); setView('chat'); }}
    />
  );

  const totalDmUnread = Object.values(dmUnread).reduce((total, count) => total + count, 0);

  return (
    <div className={`app-shell ${showMembers && server ? 'with-members' : ''}`}>
      <aside className="server-rail">
        <div className="brand-mark">W</div>
        <button className="server-icon dm-icon" onClick={() => setView('dms')} title="Mensagens diretas">
          <MessageCircle size={21} />
          {totalDmUnread > 0 && <span className="notification-badge">{Math.min(totalDmUnread, 99)}</span>}
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
            {item.imageUrl
              ? <img className="server-icon-image" src={`${API_URL}${item.imageUrl}`} alt={item.name} />
              : item.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <button className="server-icon add" onClick={() => setView('create-server')} title="Criar servidor">
          <Plus size={20} />
        </button>
      </aside>

      <aside className={`channel-panel ${mobileOpen ? 'mobile-open' : ''}`}>
        <header>
          <div className={`server-avatar ${server?.imageUrl ? 'has-image' : ''}`}>
            {server?.imageUrl
              ? <img src={`${API_URL}${server.imageUrl}`} alt={server.name} />
              : initials}
          </div>
          <div>
            <strong>{server?.name || 'WebCord'}</strong>
            <small>{server?.description || t('communitySpace')}</small>
          </div>
          {server && <button className="server-invite-button" onClick={copyServerInvite} title="Copiar link de convite"><Link2 size={17} /></button>}
        </header>
        {server && canCreateChannels && (
          <div className="server-image-actions">
            <label title="Alterar imagem do servidor"><Camera size={15} /> Imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => event.target.files?.[0] && uploadServerImage(event.target.files[0])} /></label>
            {server.imageUrl && <button title="Remover imagem do servidor" onClick={removeServerImage}><Trash2 size={15} /></button>}
          </div>
        )}
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
          {channel?.type === 'TEXT' && <button className="members-toggle" onClick={() => setSearchOpen((current) => !current)} title="Pesquisar"><Search /></button>}
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
            <section className="messages" ref={messagesRef}>
              <div className="channel-intro">
                <div><Hash size={30} /></div>
                <h1>#{channel.name}</h1>
                <p>{t('welcomeChannel')}</p>
              </div>
              {messageCursor && (
                <button className="load-older" disabled={loadingOlder} onClick={loadOlderMessages}>
                  {loadingOlder ? 'A carregar…' : 'Carregar mensagens anteriores'}
                </button>
              )}
              {messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  onReply={setReplyingTo}
                  onForward={setForwardingMessage}
                  onProfile={(author) => showProfile(author.username)}
                />
              ))}
            </section>
            <div className="composer-area">
              {mediaPicker && (
                <MediaPicker
                  initialTab={mediaPicker}
                  onClose={() => setMediaPicker(null)}
                  onSend={sendRichContent}
                />
              )}
              {replyingTo && (
                <div className="replying-banner">
                  <span>A responder a <strong>@{replyingTo.author.username}</strong></span>
                  <button onClick={() => setReplyingTo(null)}>×</button>
                </div>
              )}
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
                <button type="button" onClick={() => setMediaPicker(mediaPicker === 'gifs' ? null : 'gifs')} title="Enviar GIF"><Image size={19} /></button>
                <button type="button" onClick={() => setMediaPicker(mediaPicker === 'stickers' ? null : 'stickers')} title="Enviar figurinha"><Sticker size={19} /></button>
                <button type="submit"><Send size={20} /></button>
              </form>
            </div>
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
                <button key={member.id} onClick={() => showProfile(member.user.username, member.joinedAt)}>
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
      {searchOpen && channel?.type === 'TEXT' && (
        <SearchPanel
          endpoint={`/channels/${channel.id}/search`}
          onClose={() => setSearchOpen(false)}
          onReply={(message) => { setReplyingTo(message); setSearchOpen(false); }}
          onForward={setForwardingMessage}
        />
      )}
      {profile && (
        <ProfileModal
          user={profile}
          onClose={() => setProfile(null)}
          onMessage={profile.id !== user.id ? () => { setDmTarget(profile.username); setProfile(null); setView('dms'); } : undefined}
          onAddFriend={profile.id !== user.id ? async () => {
            await api('/friends', {
              method: 'POST',
              body: JSON.stringify({ username: profile.username }),
            });
            setProfile((current) => current ? { ...current, relationship: 'pending' } : current);
            setNotice('Pedido de amizade enviado');
          } : undefined}
        />
      )}
      {forwardingMessage && (
        <ForwardDialog
          message={forwardingMessage}
          sourceType="channel"
          onClose={() => setForwardingMessage(null)}
          onForwarded={() => setNotice('Mensagem reencaminhada')}
        />
      )}
    </div>
  );
}
