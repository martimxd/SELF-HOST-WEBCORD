import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Ban,
  Camera,
  Crown,
  DoorOpen,
  Hash,
  Heart,
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
  UserCog,
  Users,
  Video,
  X,
} from 'lucide-react';
import { API_URL, api, attachmentMessage, copyText, type UploadedFile } from './api';
import type { Channel, Message, MessagePage, Server, ServerPermission, ServerRole, User } from './types';
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
const permissionOptions: Array<{ id: ServerPermission; label: string }> = [
  { id: 'ADMINISTRATOR', label: 'Administrador' },
  { id: 'MANAGE_SERVER', label: 'Gerir servidor' },
  { id: 'MANAGE_CHANNELS', label: 'Gerir canais' },
  { id: 'MANAGE_ROLES', label: 'Gerir cargos' },
  { id: 'KICK_MEMBERS', label: 'Expulsar membros' },
  { id: 'BAN_MEMBERS', label: 'Banir membros' },
  { id: 'MANAGE_MESSAGES', label: 'Gerir mensagens' },
  { id: 'MENTION_EVERYONE', label: 'Mencionar everyone' },
  { id: 'SEND_MESSAGES', label: 'Enviar mensagens' },
  { id: 'READ_MESSAGES', label: 'Ler mensagens' },
  { id: 'ATTACH_FILES', label: 'Anexar ficheiros' },
  { id: 'JOIN_CALL', label: 'Entrar em call' },
  { id: 'SPEAK_IN_CALL', label: 'Falar em call' },
  { id: 'MUTE_MEMBERS', label: 'Mutar membros' },
  { id: 'DEAFEN_MEMBERS', label: 'Deafen membros' },
];

function ServerRail({
  servers,
  serverId,
  totalDmUnread,
  onDms,
  onSelect,
  onCreate,
}: {
  servers: Server[];
  serverId: string;
  totalDmUnread: number;
  onDms: () => void;
  onSelect: (server: Server) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="server-rail">
      <div className="brand-mark">W</div>
      <button className="server-icon dm-icon" onClick={onDms} title="Mensagens diretas">
        <MessageCircle size={21} />
        {totalDmUnread > 0 && <span className="notification-badge">{Math.min(totalDmUnread, 99)}</span>}
      </button>
      {servers.map((item) => (
        <button
          className={`server-icon ${item.id === serverId ? 'active' : ''}`}
          key={item.id}
          title={item.name}
          onClick={() => onSelect(item)}
        >
          {item.imageUrl
            ? <img className="server-icon-image" src={`${API_URL}${item.imageUrl}`} alt={item.name} />
            : item.name.slice(0, 2).toUpperCase()}
        </button>
      ))}
      <button className="server-icon add" onClick={onCreate} title="Criar servidor">
        <Plus size={20} />
      </button>
    </aside>
  );
}

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
  const [mediaPicker, setMediaPicker] = useState<'gifs' | 'stickers' | 'favorites' | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [dmUnread, setDmUnread] = useState<Record<string, number>>({});
  const [activeDirectConversationId, setActiveDirectConversationId] = useState('');
  const [serverManagementOpen, setServerManagementOpen] = useState(false);
  const [serverDeletePassword, setServerDeletePassword] = useState('');
  const [ownershipPassword, setOwnershipPassword] = useState('');
  const [ownershipTargetId, setOwnershipTargetId] = useState('');
  const [serverEditName, setServerEditName] = useState('');
  const [serverEditDescription, setServerEditDescription] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#8b5cf6');
  const [rolePermissions, setRolePermissions] = useState<ServerPermission[]>(['READ_MESSAGES', 'SEND_MESSAGES']);
  const messagesRef = useRef<HTMLElement>(null);
  const registrationToken = new URLSearchParams(window.location.search).get('register');

  const server = servers.find((item) => item.id === serverId);
  const channel = server?.channels.find((item) => item.id === channelId);
  const membership = server?.members.find((item) => item.user.id === user?.id);
  const serverPermissionSet = useMemo(() => new Set(server?.permissions ?? []), [server?.permissions]);
  const hasPermission = (permission: ServerPermission) =>
    serverPermissionSet.has('ADMINISTRATOR') || serverPermissionSet.has(permission);
  const canCreateChannels = Boolean(
    membership && (hasPermission('MANAGE_CHANNELS') || ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)),
  );
  const isServerOwner = membership?.role === 'OWNER';
  const canCustomizeServer = Boolean(membership && (hasPermission('MANAGE_SERVER') || ['OWNER', 'ADMIN'].includes(membership.role)));
  const canManageRoles = Boolean(membership && (hasPermission('MANAGE_ROLES') || isServerOwner));
  const canManageMessages = Boolean(membership && (hasPermission('MANAGE_MESSAGES') || ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)));
  const canKickMembers = Boolean(membership && (hasPermission('KICK_MEMBERS') || ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)));
  const canBanMembers = Boolean(membership && (hasPermission('BAN_MEMBERS') || ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)));

  const loadServers = useCallback(async () => {
    const result = await api<{ servers: Server[] }>('/servers');
    setServers(result.servers);
    const firstServer = result.servers[0];
    setServerId((current) => {
      const currentServer = result.servers.find((item) => item.id === current);
      if (currentServer) {
        setChannelId((currentChannel) =>
          currentServer.channels.some((item) => item.id === currentChannel)
            ? currentChannel
            : currentServer.channels[0]?.id || '',
        );
        return current;
      }
      setChannelId(firstServer?.channels[0]?.id || '');
      return firstServer?.id || '';
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
    if (!server) return;
    setServerEditName(server.name);
    setServerEditDescription(server.description || '');
  }, [server?.id, server?.name, server?.description]);

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
    const onCallUpdate = ({
      userId,
      activeCall,
    }: {
      userId: string;
      activeCall: User['activeCall'];
    }) => {
      setUser((current) => current?.id === userId ? { ...current, activeCall } : current);
      setServers((current) =>
        current.map((item) => ({
          ...item,
          members: item.members.map((member) =>
            member.user.id === userId
              ? { ...member, user: { ...member.user, activeCall } }
              : member,
          ),
        })),
      );
    };
    const refreshServers = () => loadServers().catch((err) => setError(err.message));
    const onServerRemoved = ({ serverId: removedId }: { serverId: string }) => {
      setServerManagementOpen(false);
      refreshServers();
      if (removedId === serverId) setView('chat');
    };
    socket.on('presence:update', onPresence);
    socket.on('user:update', onUserUpdate);
    socket.on('server:member:update', onServerMemberUpdate);
    socket.on('server:update', onServerUpdate);
    socket.on('user:call:update', onCallUpdate);
    socket.on('channel:created', refreshServers);
    socket.on('channel:deleted', refreshServers);
    socket.on('server:deleted', onServerRemoved);
    socket.on('server:banned', onServerRemoved);
    return () => {
      socket.off('presence:update', onPresence);
      socket.off('user:update', onUserUpdate);
      socket.off('server:member:update', onServerMemberUpdate);
      socket.off('server:update', onServerUpdate);
      socket.off('user:call:update', onCallUpdate);
      socket.off('channel:created', refreshServers);
      socket.off('channel:deleted', refreshServers);
      socket.off('server:deleted', onServerRemoved);
      socket.off('server:banned', onServerRemoved);
    };
  }, [loadServers, serverId]);

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
    const onMessageDeleted = ({
      channelId: deletedChannelId,
      messageId,
    }: {
      channelId: string;
      messageId: string;
    }) => {
      if (deletedChannelId === channelId) {
        setMessages((current) => current.filter((message) => message.id !== messageId));
      }
    };
    socket.on('message:new', onMessage);
    socket.on('message:deleted', onMessageDeleted);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onMessageDeleted);
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

  const updateServerDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!server) return;
    try {
      await api(`/servers/${server.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: serverEditName, description: serverEditDescription }),
      });
      await loadServers();
      setNotice('Alteração aplicada');
    } catch (err) {
      setError((err as Error).message);
    }
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

  const deleteChannel = async (target: Channel) => {
    if (!confirm(`Apagar o canal #${target.name}?`)) return;
    try {
      await api(`/channels/${target.id}`, { method: 'DELETE' });
      await loadServers();
      setNotice('Canal apagado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateChannel = async (target: Channel, patch: Partial<Channel>) => {
    try {
      await api(`/channels/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await loadServers();
      setNotice('Canal atualizado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const editChannel = async (target: Channel) => {
    const name = prompt('Nome do canal', target.name);
    if (!name) return;
    const category = prompt('Categoria do canal', target.category || '');
    await updateChannel(target, {
      name,
      category: category || null,
      isPrivate: confirm('Canal privado? OK para sim, Cancelar para não.'),
      isReadOnly: target.type === 'TEXT'
        ? confirm('Canal só leitura? OK para sim, Cancelar para não.')
        : false,
    });
  };

  const moveChannel = async (target: Channel, direction: -1 | 1) => {
    if (!server) return;
    const channels = [...server.channels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const index = channels.findIndex((item) => item.id === target.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= channels.length) return;
    const [item] = channels.splice(index, 1);
    if (!item) return;
    channels.splice(nextIndex, 0, item);
    try {
      await api(`/servers/${server.id}/channels/order`, {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds: channels.map((channel) => channel.id) }),
      });
      await loadServers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteMessage = async (message: Message) => {
    if (!channel || !confirm('Apagar esta mensagem?')) return;
    try {
      await api(`/channels/${channel.id}/messages/${message.id}`, { method: 'DELETE' });
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateMemberRole = async (userId: string, role: string) => {
    if (!server) return;
    try {
      await api(`/servers/${server.id}/members/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      await loadServers();
      setNotice('Cargo atualizado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!server) return;
    try {
      await api(`/servers/${server.id}/roles`, {
        method: 'POST',
        body: JSON.stringify({
          name: roleName,
          color: roleColor,
          permissions: rolePermissions,
          position: (server.roles?.[0]?.position ?? 100) + 10,
        }),
      });
      setRoleName('');
      setRolePermissions(['READ_MESSAGES', 'SEND_MESSAGES']);
      await loadServers();
      setNotice('Cargo criado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const editRole = async (role: ServerRole) => {
    if (!server) return;
    const name = prompt('Nome do cargo', role.name);
    if (!name) return;
    const color = prompt('Cor HEX do cargo', role.color) || role.color;
    try {
      await api(`/servers/${server.id}/roles/${role.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, color }),
      });
      await loadServers();
      setNotice('Cargo atualizado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteRole = async (role: ServerRole) => {
    if (!server || !confirm(`Apagar o cargo ${role.name}?`)) return;
    try {
      await api(`/servers/${server.id}/roles/${role.id}`, { method: 'DELETE' });
      await loadServers();
      setNotice('Cargo apagado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateMemberRoles = async (userId: string, roleIds: string[]) => {
    if (!server) return;
    try {
      await api(`/servers/${server.id}/members/${userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleIds }),
      });
      await loadServers();
      setNotice('Cargos do membro atualizados');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateMemberNickname = async (userId: string, currentNickname?: string | null) => {
    if (!server) return;
    const nickname = prompt('Nickname neste servidor', currentNickname || '');
    if (nickname === null) return;
    try {
      await api(`/servers/${server.id}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nickname: nickname || null }),
      });
      await loadServers();
      setNotice('Nickname atualizado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const timeoutMember = async (userId: string) => {
    if (!server) return;
    const minutes = prompt('Timeout em minutos. Deixa vazio para remover timeout.', '10');
    if (minutes === null) return;
    const value = Number(minutes);
    const until = minutes.trim() && Number.isFinite(value)
      ? new Date(Date.now() + Math.max(1, value) * 60_000).toISOString()
      : null;
    try {
      await api(`/servers/${server.id}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ until, reason: until ? `Timeout ${minutes} minutos` : 'Timeout removido' }),
      });
      await loadServers();
      setNotice(until ? 'Timeout aplicado' : 'Timeout removido');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const kickMember = async (userId: string, username: string) => {
    if (!server || !confirm(`Expulsar @${username} deste servidor?`)) return;
    try {
      await api(`/servers/${server.id}/members/${userId}/kick`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Expulso pelo painel de gestão' }),
      });
      await loadServers();
      setNotice('Membro expulso');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const banMember = async (userId: string, username: string) => {
    if (!server || !confirm(`Banir @${username} deste servidor?`)) return;
    try {
      await api(`/servers/${server.id}/members/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Banido pelo painel de gestão' }),
      });
      await loadServers();
      setNotice('Membro banido');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const unbanMember = async (userId: string) => {
    if (!server) return;
    try {
      await api(`/servers/${server.id}/bans/${userId}`, { method: 'DELETE' });
      await loadServers();
      setNotice('Ban removido');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const leaveServer = async () => {
    if (!server || !confirm(`Sair do servidor ${server.name}?`)) return;
    try {
      await api(`/servers/${server.id}/members/me`, { method: 'DELETE' });
      setServerManagementOpen(false);
      await loadServers();
      setNotice('Saíste do servidor');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteServer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!server || !serverDeletePassword) return;
    if (!confirm(`Apagar definitivamente o servidor ${server.name}?`)) return;
    try {
      await api(`/servers/${server.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: serverDeletePassword }),
      });
      setServerDeletePassword('');
      setServerManagementOpen(false);
      await loadServers();
      setNotice('Servidor apagado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const transferOwnership = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!server || !ownershipTargetId || !ownershipPassword) return;
    if (!confirm('Transferir a posse deste servidor? Tu passarás a administrador.')) return;
    try {
      await api(`/servers/${server.id}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({
          userId: ownershipTargetId,
          password: ownershipPassword,
        }),
      });
      setOwnershipPassword('');
      setOwnershipTargetId('');
      await loadServers();
      setNotice('Posse do servidor transferida');
    } catch (err) {
      setError((err as Error).message);
    }
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

  const favoriteGif = async (gif: {
    gifId: string;
    title: string;
    url: string;
    previewUrl: string;
    source: string;
  }) => {
    try {
      await api('/gif-favorites', {
        method: 'POST',
        body: JSON.stringify(gif),
      });
      setNotice(t('favoriteGif'));
    } catch (err) {
      setError((err as Error).message);
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
  const totalDmUnread = Object.values(dmUnread).reduce((total, count) => total + count, 0);
  const selectServer = (item: Server) => {
    setServerId(item.id);
    setChannelId(item.channels[0]?.id || '');
    setView('chat');
  };

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
    <div className="app-shell dm-shell">
      <ServerRail
        servers={servers}
        serverId=""
        totalDmUnread={totalDmUnread}
        onDms={() => undefined}
        onSelect={selectServer}
        onCreate={() => setView('create-server')}
      />
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
        embedded
      />
    </div>
  );

  return (
    <div className={`app-shell ${showMembers && server ? 'with-members' : ''}`}>
      <ServerRail
        servers={servers}
        serverId={serverId}
        totalDmUnread={totalDmUnread}
        onDms={() => setView('dms')}
        onSelect={selectServer}
        onCreate={() => setView('create-server')}
      />

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
          {server && membership && (
            <button className="server-invite-button" onClick={() => setServerManagementOpen(true)} title="Gerir servidor">
              <UserCog size={17} />
            </button>
          )}
        </header>
        {server && canCustomizeServer && (
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
            <div className="channel-row" key={item.id}>
              <button
                className={item.id === channelId ? 'active' : ''}
                onClick={() => {
                  setChannelId(item.id);
                  setMobileOpen(false);
                }}
              >
                {item.type === 'TEXT' ? <Hash size={18} /> : item.type === 'VIDEO' ? <Video size={18} /> : <Mic size={18} />}
                <span>{item.name}</span>
              </button>
              {canCreateChannels && (
                <button className="channel-delete" onClick={() => deleteChannel(item)} title="Apagar canal">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </nav>
        <div className="user-dock">
          <button className="avatar-button" onClick={() => showProfile(user.username)}><UserAvatar user={user} /></button>
          <div>
            <button className="username-button" onClick={() => showProfile(user.username)}><strong>{user.username}</strong></button>
            <small>{user.status === 'offline' ? 'offline' : 'online'}</small>
            {user.activeCall && <small className="active-call-status"><Mic size={11} /> {user.activeCall.label}</small>}
          </div>
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
              socket={socket}
              callKind="server"
              callTargetId={channel.id}
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
                  onFavoriteGif={favoriteGif}
                  onDelete={
                    message.author.id === user.id || canManageMessages
                      ? deleteMessage
                      : undefined
                  }
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
                <button type="button" onClick={() => setMediaPicker(mediaPicker === 'gifs' ? null : 'gifs')} title={t('sendGif')}><Image size={19} /></button>
                <button type="button" onClick={() => setMediaPicker(mediaPicker === 'favorites' ? null : 'favorites')} title={t('favoriteGifs')}><Heart size={19} /></button>
                <button type="button" onClick={() => setMediaPicker(mediaPicker === 'stickers' ? null : 'stickers')} title={t('sendSticker')}><Sticker size={19} /></button>
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
                    {member.user.activeCall && <small className="active-call-status"><Mic size={11} /> {member.user.activeCall.label}</small>}
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
      {serverManagementOpen && server && membership && (
        <div className="modal-backdrop" onClick={() => setServerManagementOpen(false)}>
          <section className="dialog-card server-management-dialog" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setServerManagementOpen(false)}><X /></button>
            <span className="eyebrow">{t('serverManagement')}</span>
            <h2>{server.name}</h2>
            <p className="muted">O teu cargo: {membership.role.toLowerCase()}</p>

            {canCustomizeServer && (
              <>
                <h3>{t('editServer')}</h3>
                <form className="management-form server-details-form" onSubmit={updateServerDetails}>
                  <input value={serverEditName} onChange={(event) => setServerEditName(event.target.value)} minLength={2} maxLength={80} />
                  <input value={serverEditDescription} onChange={(event) => setServerEditDescription(event.target.value)} maxLength={500} placeholder="Descrição" />
                  <button className="secondary-button">{t('save')}</button>
                </form>
                <div className="server-image-actions modal-server-image-actions">
                  <label title="Alterar imagem do servidor">
                    <Camera size={15} /> {t('serverImage')}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => event.target.files?.[0] && uploadServerImage(event.target.files[0])} />
                  </label>
                  {server.imageUrl && <button title="Remover imagem do servidor" onClick={removeServerImage}><Trash2 size={15} /></button>}
                </div>
              </>
            )}

            {canCreateChannels && (
              <>
                <h3>{t('channels')}</h3>
                <div className="server-member-management channel-management-list">
                  {server.channels.map((item) => (
                    <div className="managed-member-row channel-management-row" key={item.id}>
                      {item.type === 'TEXT' ? <Hash size={18} /> : item.type === 'VIDEO' ? <Video size={18} /> : <Mic size={18} />}
                      <span>
                        <strong>#{item.name}</strong>
                        <small>
                          {item.type.toLowerCase()}
                          {item.category ? ` · ${item.category}` : ''}
                          {item.isPrivate ? ' · privado' : ''}
                          {item.isReadOnly ? ' · só leitura' : ''}
                        </small>
                      </span>
                      <button className="secondary-button compact-action" onClick={() => moveChannel(item, -1)}>↑</button>
                      <button className="secondary-button compact-action" onClick={() => moveChannel(item, 1)}>↓</button>
                      <button className="secondary-button compact-action" onClick={() => editChannel(item)}><Settings size={15} /></button>
                      <button className="danger-icon-button" onClick={() => deleteChannel(item)} title={t('deleteChannel')}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {canManageRoles && (
              <>
                <h3>Cargos e permissões</h3>
                <form className="role-create-form" onSubmit={createRole}>
                  <input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Nome do cargo" minLength={1} maxLength={80} />
                  <input type="color" value={roleColor} onChange={(event) => setRoleColor(event.target.value)} />
                  <div className="permission-grid">
                    {permissionOptions.map((permission) => (
                      <label key={permission.id}>
                        <input
                          type="checkbox"
                          checked={rolePermissions.includes(permission.id)}
                          onChange={(event) => {
                            setRolePermissions((current) =>
                              event.target.checked
                                ? [...current, permission.id]
                                : current.filter((item) => item !== permission.id),
                            );
                          }}
                        />
                        <span>{permission.label}</span>
                      </label>
                    ))}
                  </div>
                  <button className="secondary-button"><Plus size={16} /> Criar cargo</button>
                </form>
                <div className="server-member-management role-list">
                  {server.roles?.map((role) => (
                    <div className="managed-member-row" key={role.id}>
                      <span className="role-color-dot" style={{ background: role.color }} />
                      <span>
                        <strong>{role.name}</strong>
                        <small>{role.permissions.length} permissões · posição {role.position}</small>
                      </span>
                      <button className="secondary-button compact-action" onClick={() => editRole(role)}><Settings size={15} /></button>
                      <button className="danger-icon-button" onClick={() => deleteRole(role)}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(canCreateChannels || canKickMembers || canBanMembers || canManageRoles) && (
              <>
                <h3>{t('membersAndRoles')}</h3>
                <div className="server-member-management">
                  {server.members.map((member) => (
                    <div className="managed-member-row" key={member.id}>
                      <UserAvatar user={member.user} />
                      <span>
                        <strong>{member.nickname || `@${member.user.username}`}</strong>
                        <small>
                          @{member.user.username} · {member.role.toLowerCase()} · entrou {new Date(member.joinedAt).toLocaleDateString('pt-PT')}
                          {member.timeoutUntil ? ` · timeout ${new Date(member.timeoutUntil).toLocaleString('pt-PT')}` : ''}
                        </small>
                      </span>
                      {canManageRoles && member.user.id !== user.id ? (
                        <select
                          value={member.role}
                          onChange={(event) => updateMemberRole(member.user.id, event.target.value)}
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="MODERATOR">Moderador</option>
                          <option value="MEMBER">Membro</option>
                        </select>
                      ) : <em>{member.role === 'OWNER' ? <Crown size={16} /> : member.role}</em>}
                      {canManageRoles && member.user.id !== user.id && (
                        <select
                          multiple
                          value={member.roleAssignments?.map((assignment) => assignment.role.id) ?? []}
                          onChange={(event) => updateMemberRoles(
                            member.user.id,
                            Array.from(event.currentTarget.selectedOptions).map((option) => option.value),
                          )}
                        >
                          {server.roles?.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      )}
                      {(canCustomizeServer || member.user.id === user.id) && (
                        <button className="secondary-button compact-action" onClick={() => updateMemberNickname(member.user.id, member.nickname)}>
                          <UserCog size={15} />
                        </button>
                      )}
                      {canManageMessages && member.user.id !== user.id && member.role !== 'OWNER' && (
                        <button className="secondary-button compact-action" onClick={() => timeoutMember(member.user.id)}>
                          Timeout
                        </button>
                      )}
                      {member.user.id !== user.id
                        && member.role !== 'OWNER'
                        && (canKickMembers || canBanMembers) && (
                        <>
                          {canKickMembers && (
                            <button
                              className="danger-icon-button"
                              onClick={() => kickMember(member.user.id, member.user.username)}
                              title="Expulsar membro"
                            >
                              <DoorOpen size={17} />
                            </button>
                          )}
                          {canBanMembers && (
                            <button
                              className="danger-icon-button"
                              onClick={() => banMember(member.user.id, member.user.username)}
                              title={t('banMember')}
                            >
                              <Ban size={17} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {(server.bans?.length ?? 0) > 0 && (
                  <>
                    <h3>{t('bannedUsers')}</h3>
                    <div className="server-member-management">
                      {server.bans?.map((ban) => (
                        <div className="managed-member-row" key={ban.id}>
                          <UserAvatar user={ban.user} />
                          <span>
                            <strong>@{ban.user.username}</strong>
                            <small>{ban.reason || 'Banido'} · {new Date(ban.createdAt).toLocaleDateString('pt-PT')}</small>
                          </span>
                          <button className="secondary-button" onClick={() => unbanMember(ban.user.id)}>{t('unban')}</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {(server.moderationLogs?.length ?? 0) > 0 && (
              <>
                <h3>Logs de moderação</h3>
                <div className="moderation-log-list">
                  {server.moderationLogs?.map((log) => (
                    <div key={log.id}>
                      <strong>{log.action}</strong>
                      <span>{log.actor ? `@${log.actor.username}` : 'sistema'} · {new Date(log.createdAt).toLocaleString('pt-PT')}</span>
                      {log.details && <small>{log.details}</small>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {isServerOwner ? (
              <>
                <h3>Transferir posse</h3>
                <form className="management-form" onSubmit={transferOwnership}>
                  <select value={ownershipTargetId} onChange={(event) => setOwnershipTargetId(event.target.value)} required>
                    <option value="">Escolher membro</option>
                    {server.members
                      .filter((member) => member.user.id !== user.id)
                      .map((member) => <option key={member.id} value={member.user.id}>@{member.user.username}</option>)}
                  </select>
                  <input
                    type="password"
                    value={ownershipPassword}
                    onChange={(event) => setOwnershipPassword(event.target.value)}
                    placeholder="A tua palavra-passe"
                    required
                  />
                  <button className="secondary-button"><Crown size={16} /> Transferir posse</button>
                </form>
                <h3>Apagar servidor</h3>
                <form className="management-form danger-zone" onSubmit={deleteServer}>
                  <input
                    type="password"
                    value={serverDeletePassword}
                    onChange={(event) => setServerDeletePassword(event.target.value)}
                    placeholder="A tua palavra-passe"
                    required
                  />
                  <button className="danger-button"><Trash2 size={16} /> Apagar definitivamente</button>
                </form>
              </>
            ) : (
              <button className="danger-button leave-server-button" onClick={leaveServer}>
                <DoorOpen size={17} /> Sair do servidor
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
