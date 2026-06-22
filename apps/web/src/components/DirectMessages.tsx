import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Camera,
  Check,
  DoorOpen,
  Link2,
  Image,
  MessageCircle,
  Mic,
  Plus,
  Pencil,
  Search,
  Send,
  Search as SearchIcon,
  Sticker,
  Trash2,
  UserMinus,
  UserPlus,
  UserX,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { API_URL, api, attachmentMessage, copyText, type UploadedFile } from '../api';
import type {
  DirectConversation,
  FriendsPayload,
  Message,
  MessagePage,
  User,
} from '../types';
import { CallRoom } from './CallRoom';
import { ProfileModal } from './ProfileModal';
import { UserAvatar } from './UserAvatar';
import { MessageRow } from './MessageRow';
import { ForwardDialog } from './ForwardDialog';
import { MediaPicker } from './MediaPicker';
import { SearchPanel } from './SearchPanel';

const emptyFriends: FriendsPayload = { friends: [], incoming: [], outgoing: [], blocked: [] };

function conversationPreview(content?: string | null) {
  if (!content) return '';
  const callLog = content.match(
    /^\[call-log started="([^"]+)" ended="([^"]*)" duration="(\d+)"\]$/,
  );
  if (!callLog) return content;
  return callLog[2] ? 'Chamada terminada' : 'Chamada em curso';
}

function ConversationAvatar({ conversation }: { conversation: DirectConversation }) {
  if (!conversation.isGroup && conversation.otherUser) {
    return <UserAvatar user={conversation.otherUser} />;
  }
  if (conversation.imageUrl) {
    return <div className="avatar group-avatar has-image"><img src={`${API_URL}${conversation.imageUrl}`} alt={conversation.name} /></div>;
  }
  return <div className="avatar group-avatar"><Users size={18} /></div>;
}

export function DirectMessages({
  currentUser,
  socket,
  onBack,
  initialUsername,
  unreadCounts,
  onConversationRead,
  onActiveConversationChange,
  embedded = false,
}: {
  currentUser: User;
  socket: Socket;
  onBack: () => void;
  initialUsername?: string;
  unreadCounts: Record<string, number>;
  onConversationRead: (conversationId: string) => void;
  onActiveConversationChange: (conversationId: string) => void;
  embedded?: boolean;
}) {
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [friends, setFriends] = useState<FriendsPayload>(emptyFriends);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [callMode, setCallMode] = useState<'audio' | 'video' | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [section, setSection] = useState<'chats' | 'friends'>('chats');
  const [dialog, setDialog] = useState<'dm' | 'group' | 'members' | 'nickname' | null>(null);
  const [friendUsername, setFriendUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [memberUsername, setMemberUsername] = useState('');
  const [notice, setNotice] = useState('');
  const [acceptingFriendId, setAcceptingFriendId] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [mediaPicker, setMediaPicker] = useState<'gifs' | 'stickers' | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  const messagesRef = useRef<HTMLElement>(null);
  const selected = conversations.find((item) => item.id === selectedId);

  const loadConversations = async () => {
    const result = await api<{ conversations: DirectConversation[] }>('/direct-conversations');
    setConversations(result.conversations);
    setSelectedId((current) => {
      if (current && result.conversations.some((conversation) => conversation.id === current)) {
        return current;
      }
      return isMobile ? '' : result.conversations[0]?.id || '';
    });
  };

  const loadFriends = async () => {
    const result = await api<FriendsPayload>('/friends');
    setFriends(result);
  };

  const reload = async () => {
    await Promise.all([loadConversations(), loadFriends()]);
  };

  const openUsername = async (username: string) => {
    const result = await api<{ conversation: DirectConversation }>('/direct-conversations', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    setConversations((items) => [
      result.conversation,
      ...items.filter((item) => item.id !== result.conversation.id),
    ]);
    setSelectedId(result.conversation.id);
    setSection('chats');
    setDialog(null);
  };

  const openProfile = async (username: string) => {
    try {
      const result = await api<{ user: User }>(`/users/${encodeURIComponent(username)}/profile`);
      setProfile(result.user);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    reload().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!initialUsername) return;
    openUsername(initialUsername).catch((err) => {
      setFriendUsername(initialUsername);
      setSection('friends');
      setError(err.message);
    });
  }, [initialUsername]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setMessageCursor(null);
      onActiveConversationChange('');
      return;
    }
    setCallMode(null);
    setReplyingTo(null);
    setMediaPicker(null);
    setSearchOpen(false);
    onActiveConversationChange(selectedId);
    onConversationRead(selectedId);
    api<MessagePage>(`/direct-conversations/${selectedId}/messages`)
      .then((result) => {
        setMessages(result.messages);
        setMessageCursor(result.nextCursor);
        requestAnimationFrame(() => {
          if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        });
      })
      .catch((err) => setError(err.message));
    socket.emit('dm:join', selectedId);
    const onMessage = (message: Message) => {
      if (message.conversationId !== selectedId) return;
      const shouldFollow = !messagesRef.current
        || messagesRef.current.scrollHeight - messagesRef.current.scrollTop - messagesRef.current.clientHeight < 140;
      setMessages((items) =>
        items.some((item) => item.id === message.id) ? items : [...items, message],
      );
      loadConversations().catch((err) => setError(err.message));
      if (shouldFollow) {
        requestAnimationFrame(() => {
          if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        });
      }
    };
    const onConversationUpdate = () => loadConversations().catch((err) => setError(err.message));
    const onMemberRemoved = ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      if (conversationId === selectedId && userId === currentUser.id) {
        setSelectedId('');
      }
      loadConversations().catch((err) => setError(err.message));
    };
    const onMessageDeleted = ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId: string;
    }) => {
      if (conversationId === selectedId) {
        setMessages((items) => items.filter((message) => message.id !== messageId));
      }
    };
    const onMessageUpdated = (message: Message) => {
      if (message.conversationId === selectedId) {
        setMessages((items) =>
          items.map((item) => item.id === message.id ? message : item),
        );
      }
      loadConversations().catch((err) => setError(err.message));
    };
    const onConversationDeleted = ({ conversationId }: { conversationId: string }) => {
      if (conversationId === selectedId) setSelectedId('');
      loadConversations().catch((err) => setError(err.message));
    };
    socket.on('dm:message:new', onMessage);
    socket.on('dm:conversation:update', onConversationUpdate);
    socket.on('dm:member:removed', onMemberRemoved);
    socket.on('dm:message:deleted', onMessageDeleted);
    socket.on('dm:message:updated', onMessageUpdated);
    socket.on('dm:conversation:deleted', onConversationDeleted);
    return () => {
      socket.off('dm:message:new', onMessage);
      socket.off('dm:conversation:update', onConversationUpdate);
      socket.off('dm:member:removed', onMemberRemoved);
      socket.off('dm:message:deleted', onMessageDeleted);
      socket.off('dm:message:updated', onMessageUpdated);
      socket.off('dm:conversation:deleted', onConversationDeleted);
    };
  }, [selectedId, socket, currentUser.id]);

  useEffect(() => () => onActiveConversationChange(''), [onActiveConversationChange]);

  useEffect(() => {
    const refreshConversations = () => loadConversations().catch((err) => setError(err.message));
    socket.on('dm:notification', refreshConversations);
    return () => {
      socket.off('dm:notification', refreshConversations);
    };
  }, [socket, isMobile]);

  useEffect(() => {
    const handler = ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
      setConversations((items) =>
        items.map((conversation) => ({
          ...conversation,
          members: conversation.members.map((member) =>
            member.id === userId ? { ...member, status } : member,
          ),
          otherUser:
            conversation.otherUser?.id === userId
              ? { ...conversation.otherUser, status }
              : conversation.otherUser,
        })),
      );
      setFriends((current) => ({
        friends: current.friends.map((friend) =>
          friend.id === userId ? { ...friend, status } : friend,
        ),
        incoming: current.incoming.map((request) =>
          request.user.id === userId
            ? { ...request, user: { ...request.user, status } }
            : request,
        ),
        outgoing: current.outgoing.map((request) =>
          request.user.id === userId
            ? { ...request, user: { ...request.user, status } }
            : request,
        ),
        blocked: current.blocked.map((blocked) =>
          blocked.id === userId ? { ...blocked, status } : blocked,
        ),
      }));
    };
    const refreshFriends = () => loadFriends().catch((err) => setError(err.message));
    const refreshUsers = () => reload().catch((err) => setError(err.message));
    socket.on('presence:update', handler);
    socket.on('friend:update', refreshFriends);
    socket.on('user:update', refreshUsers);
    return () => {
      socket.off('presence:update', handler);
      socket.off('friend:update', refreshFriends);
      socket.off('user:update', refreshUsers);
    };
  }, [socket]);

  const addFriend = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api('/friends', {
        method: 'POST',
        body: JSON.stringify({ username: friendUsername }),
      });
      setFriendUsername('');
      await loadFriends();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyFriendLink = async () => {
    try {
      const result = await api<{ token: string }>('/friends/link', { method: 'POST' });
      await copyText(
        `${window.location.origin}/?friendInvite=${result.token}`,
      );
      setNotice('Link para adicionar amigo copiado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const acceptFriend = async (id: string) => {
    setAcceptingFriendId(id);
    setError('');
    try {
      const result = await api<{ friend: User }>(`/friends/${id}/accept`, { method: 'POST' });
      setFriends((current) => ({
        friends: [
          result.friend,
          ...current.friends.filter((friend) => friend.id !== result.friend.id),
        ],
        incoming: current.incoming.filter((request) => request.id !== id),
        outgoing: current.outgoing,
        blocked: current.blocked,
      }));
      setNotice(`@${result.friend.username} foi adicionado aos amigos`);
    } catch (err) {
      setError((err as Error).message);
      await loadFriends();
    } finally {
      setAcceptingFriendId('');
    }
  };

  const removeRequest = async (id: string) => {
    await api(`/friends/${id}`, { method: 'DELETE' });
    await loadFriends();
  };

  const removeFriend = async (userId: string) => {
    await api(`/friends/user/${userId}`, { method: 'DELETE' });
    await loadFriends();
  };

  const blockUser = async (userId: string) => {
    await api(`/blocks/${userId}`, { method: 'POST' });
    await reload();
    setNotice('Utilizador bloqueado');
  };

  const unblockUser = async (userId: string) => {
    await api(`/blocks/${userId}`, { method: 'DELETE' });
    await loadFriends();
  };

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    const usernames = friends.friends
      .filter((friend) => selectedFriends.includes(friend.id))
      .map((friend) => friend.username);
    try {
      const result = await api<{ conversation: DirectConversation }>('/direct-groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, usernames }),
      });
      setConversations((items) => [result.conversation, ...items]);
      setSelectedId(result.conversation.id);
      setGroupName('');
      setSelectedFriends([]);
      setSection('chats');
      setDialog(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addGroupMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try {
      const result = await api<{ conversation: DirectConversation }>(
        `/direct-conversations/${selected.id}/members`,
        { method: 'POST', body: JSON.stringify({ username: memberUsername }) },
      );
      setConversations((items) =>
        items.map((item) => (item.id === selected.id ? result.conversation : item)),
      );
      setMemberUsername('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeGroupMember = async (userId: string) => {
    if (!selected) return;
    try {
      await api(`/direct-conversations/${selected.id}/members/${userId}`, { method: 'DELETE' });
      if (userId === currentUser.id) {
        setDialog(null);
        setSelectedId('');
      }
      await loadConversations();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !selectedId) return;
    const content = text;
    setText('');
    try {
      await api(`/direct-conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, replyToId: replyingTo?.id }),
      });
      setReplyingTo(null);
    } catch (err) {
      setText(content);
      setError((err as Error).message);
    }
  };

  const sendRichContent = async (content: string) => {
    if (!selectedId) return;
    await api(`/direct-conversations/${selectedId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId: replyingTo?.id }),
    });
    setReplyingTo(null);
  };

  const loadOlderMessages = async () => {
    if (!selectedId || !messageCursor || loadingOlder) return;
    const container = messagesRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const result = await api<MessagePage>(
        `/direct-conversations/${selectedId}/messages?cursor=${encodeURIComponent(messageCursor)}`,
      );
      setMessages((current) => [...result.messages, ...current]);
      setMessageCursor(result.nextCursor);
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const saveNickname = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || selected.isGroup) return;
    try {
      const result = await api<{ nickname: string | null }>(
        `/direct-conversations/${selected.id}/nickname`,
        { method: 'PATCH', body: JSON.stringify({ nickname }) },
      );
      setConversations((items) =>
        items.map((conversation) =>
          conversation.id === selected.id
            ? { ...conversation, nickname: result.nickname }
            : conversation,
        ),
      );
      setDialog(null);
      setNotice(result.nickname ? 'Apelido guardado' : 'Apelido removido');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteMessage = async (message: Message) => {
    if (!selectedId || !confirm('Apagar esta mensagem?')) return;
    try {
      await api(`/direct-conversations/${selectedId}/messages/${message.id}`, {
        method: 'DELETE',
      });
      setMessages((items) => items.filter((item) => item.id !== message.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const upload = async (file: File) => {
    if (!selectedId) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api<{ upload: UploadedFile }>(
        `/direct-conversations/${selectedId}/uploads`,
        { method: 'POST', body: form },
      );
      await api(`/direct-conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: attachmentMessage(result.upload) }),
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const uploadGroupImage = async (file: File) => {
    if (!selected?.isGroup) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api<{ imageUrl: string }>(
        `/direct-conversations/${selected.id}/image`,
        { method: 'POST', body: form },
      );
      setConversations((items) =>
        items.map((item) =>
          item.id === selected.id ? { ...item, imageUrl: result.imageUrl } : item,
        ),
      );
      setNotice('Imagem do grupo atualizada');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeGroupImage = async () => {
    if (!selected?.isGroup) return;
    try {
      await api(`/direct-conversations/${selected.id}/image`, { method: 'DELETE' });
      setConversations((items) =>
        items.map((item) => item.id === selected.id ? { ...item, imageUrl: null } : item),
      );
      setNotice('Imagem do grupo removida');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleGroupFriend = (id: string) => {
    setSelectedFriends((current) =>
      current.includes(id)
        ? current.filter((friendId) => friendId !== id)
        : current.length < 9
          ? [...current, id]
          : current,
    );
  };

  const title = selected?.isGroup
    ? selected.name
    : selected?.otherUser
      ? selected.nickname || `@${selected.otherUser.username}`
      : '';

  return (
    <div className={`dm-page ${selected ? 'conversation-selected' : ''} ${embedded ? 'dm-embedded' : ''}`}>
      <aside className="dm-sidebar">
        <header>{!embedded && <button onClick={onBack}><ArrowLeft /></button>}<strong>Mensagens</strong></header>
        <div className="dm-tabs">
          <button className={section === 'chats' ? 'active' : ''} onClick={() => setSection('chats')}>
            <MessageCircle size={17} /> Conversas
          </button>
          <button className={section === 'friends' ? 'active' : ''} onClick={() => setSection('friends')}>
            <Users size={17} /> Amigos
            {friends.incoming.length > 0 && <span>{friends.incoming.length}</span>}
          </button>
        </div>
        {section === 'chats' ? (
          <>
            <div className="dm-actions">
              <button onClick={() => setDialog('dm')}><Plus size={17} /> Nova DM</button>
              <button onClick={() => setDialog('group')}><Users size={17} /> Novo grupo</button>
            </div>
            <div className="dm-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={conversation.id === selectedId ? 'active' : ''}
                  onClick={() => {
                    setSelectedId(conversation.id);
                    onConversationRead(conversation.id);
                  }}
                >
                  <ConversationAvatar conversation={conversation} />
                  <div>
                    <strong>{conversation.isGroup ? conversation.name : conversation.nickname || `@${conversation.otherUser?.username}`}</strong>
                    <small>{conversationPreview(conversation.lastMessage?.content) || `${conversation.members.length} membro${conversation.members.length === 1 ? '' : 's'}`}</small>
                  </div>
                  {(unreadCounts[conversation.id] ?? 0) > 0 && (
                    <span className="dm-unread">{Math.min(unreadCounts[conversation.id] ?? 0, 99)}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="friends-panel">
            <button className="friend-link-button" onClick={copyFriendLink}>
              <Link2 size={18} /> Copiar o meu link de amizade
            </button>
            <form className="friend-search" onSubmit={addFriend}>
              <input
                value={friendUsername}
                onChange={(event) => setFriendUsername(event.target.value)}
                placeholder="Adicionar por username"
              />
              <button title="Enviar pedido"><UserPlus size={18} /></button>
            </form>
            {friends.incoming.length > 0 && <h3>Pedidos recebidos</h3>}
            {friends.incoming.map((request) => (
              <div className="friend-row" key={request.id}>
                <UserAvatar user={request.user} />
                <strong>@{request.user.username}</strong>
                <button
                  type="button"
                  disabled={acceptingFriendId === request.id}
                  onClick={() => acceptFriend(request.id)}
                  title="Aceitar"
                >
                  <Check />
                </button>
                <button onClick={() => removeRequest(request.id)} title="Recusar"><X /></button>
              </div>
            ))}
            {friends.outgoing.length > 0 && <h3>Pedidos enviados</h3>}
            {friends.outgoing.map((request) => (
              <div className="friend-row" key={request.id}>
                <UserAvatar user={request.user} />
                <strong>@{request.user.username}</strong>
                <small>Pendente</small>
                <button onClick={() => removeRequest(request.id)} title="Cancelar"><X /></button>
              </div>
            ))}
            <h3>Amigos</h3>
            {friends.friends.map((friend) => (
              <div className="friend-row" key={friend.id}>
                <button className="friend-profile" onClick={() => openProfile(friend.username)}>
                  <UserAvatar user={friend} />
                  <span><strong>@{friend.username}</strong><small>{friend.status === 'online' ? 'Online' : 'Offline'}</small></span>
                </button>
                <button onClick={() => openUsername(friend.username)} title="Mensagem"><MessageCircle /></button>
                <button onClick={() => removeFriend(friend.id)} title="Remover amigo"><UserMinus /></button>
                <button onClick={() => blockUser(friend.id)} title="Bloquear"><Ban /></button>
              </div>
            ))}
            {friends.blocked.length > 0 && <h3>Bloqueados</h3>}
            {friends.blocked.map((blocked) => (
              <div className="friend-row" key={blocked.id}>
                <UserAvatar user={blocked} />
                <strong>@{blocked.username}</strong>
                <button onClick={() => unblockUser(blocked.id)} title="Desbloquear"><UserX /></button>
              </div>
            ))}
          </div>
        )}
        <div className="dm-current-user">
          <UserAvatar user={currentUser} />
          <span>
            <strong>@{currentUser.username}</strong>
            <small>{currentUser.status === 'offline' ? 'offline' : 'online'}</small>
            {currentUser.activeCall && (
              <small className="active-call-status"><Mic size={11} /> {currentUser.activeCall.label}</small>
            )}
          </span>
        </div>
      </aside>
      <main className="chat-panel">
        {selected ? (
          <>
            <header className="chat-header">
              <button className="mobile-conversation-back" onClick={() => setSelectedId('')} title="Voltar às conversas">
                <ArrowLeft />
              </button>
              <button
                className="profile-name"
                onClick={() => selected.otherUser && openProfile(selected.otherUser.username)}
              >
                <ConversationAvatar conversation={selected} />
                <strong>{title}</strong>
              </button>
              {selected.isGroup && <span>{selected.members.length}/10 membros</span>}
              {!selected.isGroup && (
                <button
                  className="call-action nickname-action"
                  onClick={() => {
                    setNickname(selected.nickname || '');
                    setDialog('nickname');
                  }}
                  title="Definir apelido"
                >
                  <Pencil />
                </button>
              )}
              <button className="push-right call-action" onClick={() => setCallMode('audio')} title="Chamada de voz"><Mic /></button>
              <button className="call-action" onClick={() => setCallMode('video')} title="Chamada de vídeo"><Video /></button>
              <button className="call-action" onClick={() => setSearchOpen((current) => !current)} title="Pesquisar"><SearchIcon /></button>
              {selected.isGroup && (
                <label className="call-action group-image-action" title="Alterar imagem do grupo">
                  <Camera />
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => event.target.files?.[0] && uploadGroupImage(event.target.files[0])} />
                </label>
              )}
              {selected.isGroup && <button className="call-action" onClick={() => setDialog('members')} title="Membros"><Users /></button>}
              {selected.isGroup && (
                <button className="call-action" onClick={() => removeGroupMember(currentUser.id)} title="Sair do grupo">
                  <DoorOpen />
                </button>
              )}
            </header>
            {callMode ? (
              <CallRoom
                name={title}
                tokenEndpoint={`/direct-conversations/${selected.id}/call-token`}
                videoEnabled={callMode === 'video'}
                socket={socket}
                callKind="direct"
                callTargetId={selected.id}
              />
            ) : (
              <>
                <section className="messages" ref={messagesRef}>
                  <div className="channel-intro">
                    <div>{selected.isGroup ? <Users /> : <MessageCircle />}</div>
                    <h1>{title}</h1>
                    <p>{selected.isGroup ? `Grupo privado com ${selected.members.length} membros.` : 'Esta é uma conversa privada entre amigos.'}</p>
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
                      onProfile={(author) => openProfile(author.username)}
                      authorDisplayName={
                        !selected.isGroup
                        && selected.nickname
                        && message.author.id === selected.otherUser?.id
                          ? selected.nickname
                          : undefined
                      }
                      onDelete={message.author.id === currentUser.id ? deleteMessage : undefined}
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
                    <label className="attach" title="Enviar anexo"><Plus /><input type="file" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} /></label>
                    <input value={text} onChange={(event) => setText(event.target.value)} placeholder={`Mensagem para ${title}`} />
                    <button type="button" onClick={() => setMediaPicker(mediaPicker === 'gifs' ? null : 'gifs')} title="Enviar GIF"><Image size={19} /></button>
                    <button type="button" onClick={() => setMediaPicker(mediaPicker === 'stickers' ? null : 'stickers')} title="Enviar figurinha"><Sticker size={19} /></button>
                    <button><Send size={20} /></button>
                  </form>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="empty-state"><Search size={52} /><h1>Conversas privadas</h1><p>Adiciona pessoas pelo username e começa uma DM ou um grupo com até 10 membros.</p><button className="primary" onClick={() => setSection('friends')}>Encontrar amigos</button></div>
        )}
        {error && <button className="toast" onClick={() => setError('')}>{error}</button>}
        {notice && <button className="toast success-toast" onClick={() => setNotice('')}>{notice}</button>}
      </main>

      {dialog === 'dm' && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setDialog(null)}><X /></button>
            <span className="eyebrow">NOVA DM</span>
            <h2>Escolhe um amigo</h2>
            <div className="dialog-list">
              {friends.friends.map((friend) => (
                <button key={friend.id} onClick={() => openUsername(friend.username)}>
                  <UserAvatar user={friend} />
                  <span><strong>@{friend.username}</strong><small>{friend.status === 'online' ? 'Online' : 'Offline'}</small></span>
                  <MessageCircle />
                </button>
              ))}
            </div>
            {!friends.friends.length && <p className="muted">Aceita um pedido de amizade antes de iniciar uma DM.</p>}
          </section>
        </div>
      )}

      {dialog === 'group' && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <form className="dialog-card" onSubmit={createGroup} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setDialog(null)}><X /></button>
            <span className="eyebrow">GRUPO PRIVADO</span>
            <h2>Cria um grupo</h2>
            <label>Nome do grupo<input required minLength={2} maxLength={80} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Equipa do projeto" /></label>
            <p className="muted">Podes criar o grupo vazio e adicionar até 9 amigos depois.</p>
            <div className="dialog-list selectable">
              {friends.friends.map((friend) => (
                <button type="button" className={selectedFriends.includes(friend.id) ? 'selected' : ''} key={friend.id} onClick={() => toggleGroupFriend(friend.id)}>
                  <UserAvatar user={friend} />
                  <strong>@{friend.username}</strong>
                  <span className="selection-check">{selectedFriends.includes(friend.id) && <Check />}</span>
                </button>
              ))}
            </div>
            <button className="primary" disabled={selectedFriends.length > 9}>Criar grupo ({selectedFriends.length + 1}/10)</button>
          </form>
        </div>
      )}

      {dialog === 'members' && selected?.isGroup && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setDialog(null)}><X /></button>
            <span className="eyebrow">MEMBROS</span>
            <h2>{selected.name}</h2>
            {selected.imageUrl && (
              <button className="danger-button group-image-remove" onClick={removeGroupImage}>
                <Trash2 size={16} /> Remover imagem do grupo
              </button>
            )}
            {selected.ownerId === currentUser.id && selected.members.length < 10 && (
              <form className="friend-search" onSubmit={addGroupMember}>
                <input value={memberUsername} onChange={(event) => setMemberUsername(event.target.value)} placeholder="Adicionar amigo por username" />
                <button><UserPlus /></button>
              </form>
            )}
            <div className="dialog-list">
              {selected.members.map((member) => (
                <div className="group-member-row" key={member.id}>
                  <UserAvatar user={member} />
                  <span><strong>@{member.username}</strong><small>{member.status === 'online' ? 'Online' : 'Offline'}{member.id === selected.ownerId ? ' · Criador' : ''}</small></span>
                  {(member.id === currentUser.id || (member.id !== selected.ownerId && selected.ownerId === currentUser.id)) && (
                    <button onClick={() => removeGroupMember(member.id)} title={member.id === currentUser.id ? 'Sair do grupo' : 'Remover membro'}><UserMinus /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {dialog === 'nickname' && selected && !selected.isGroup && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <form className="dialog-card nickname-dialog" onSubmit={saveNickname} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setDialog(null)}><X /></button>
            <span className="eyebrow">APELIDO PESSOAL</span>
            <h2>Como queres chamar @{selected.otherUser?.username}?</h2>
            <label>
              Apelido
              <input
                autoFocus
                maxLength={40}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={selected.otherUser?.username}
              />
            </label>
            <p className="muted">Só tu vês este apelido. Deixa vazio para voltar ao username original.</p>
            <button className="primary">Guardar apelido</button>
          </form>
        </div>
      )}

      {profile && (
        <ProfileModal
          user={profile}
          onClose={() => setProfile(null)}
          onMessage={profile.relationship === 'friend' ? () => {
            openUsername(profile.username).catch((err) => setError(err.message));
            setProfile(null);
          } : undefined}
          onAddFriend={profile.relationship === 'none' ? async () => {
            await api('/friends', {
              method: 'POST',
              body: JSON.stringify({ username: profile.username }),
            });
            setProfile((current) => current ? { ...current, relationship: 'pending' } : current);
            await loadFriends();
          } : undefined}
        />
      )}
      {searchOpen && selected && (
        <SearchPanel
          endpoint={`/direct-conversations/${selected.id}/search`}
          onClose={() => setSearchOpen(false)}
          onReply={(message) => { setReplyingTo(message); setSearchOpen(false); }}
          onForward={setForwardingMessage}
        />
      )}
      {forwardingMessage && (
        <ForwardDialog
          message={forwardingMessage}
          sourceType="direct"
          onClose={() => setForwardingMessage(null)}
          onForwarded={() => setNotice('Mensagem reencaminhada')}
        />
      )}
    </div>
  );
}
