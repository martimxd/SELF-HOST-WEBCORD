import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Check,
  Link2,
  Image,
  MessageCircle,
  Mic,
  Plus,
  Search,
  Send,
  Search as SearchIcon,
  Sticker,
  UserMinus,
  UserPlus,
  UserX,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { api, attachmentMessage, copyText, type UploadedFile } from '../api';
import type {
  DirectConversation,
  FriendsPayload,
  Message,
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

function ConversationAvatar({ conversation }: { conversation: DirectConversation }) {
  if (!conversation.isGroup && conversation.otherUser) {
    return <UserAvatar user={conversation.otherUser} />;
  }
  return <div className="avatar group-avatar"><Users size={18} /></div>;
}

export function DirectMessages({
  currentUser,
  socket,
  onBack,
  initialUsername,
}: {
  currentUser: User;
  socket: Socket;
  onBack: () => void;
  initialUsername?: string;
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
  const [dialog, setDialog] = useState<'dm' | 'group' | 'members' | null>(null);
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
  const selected = conversations.find((item) => item.id === selectedId);

  const loadConversations = async () => {
    const result = await api<{ conversations: DirectConversation[] }>('/direct-conversations');
    setConversations(result.conversations);
    setSelectedId((current) => current || result.conversations[0]?.id || '');
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
    if (!initialUsername) return;
    openUsername(initialUsername).catch((err) => {
      setFriendUsername(initialUsername);
      setSection('friends');
      setError(err.message);
    });
  }, [initialUsername]);

  useEffect(() => {
    if (!selectedId) return;
    setCallMode(null);
    setReplyingTo(null);
    setMediaPicker(null);
    setSearchOpen(false);
    api<{ messages: Message[] }>(`/direct-conversations/${selectedId}/messages`)
      .then((result) => setMessages(result.messages))
      .catch((err) => setError(err.message));
    socket.emit('dm:join', selectedId);
    const onMessage = (message: Message) => {
      if (message.conversationId !== selectedId) return;
      setMessages((items) =>
        items.some((item) => item.id === message.id) ? items : [...items, message],
      );
    };
    const onConversationUpdate = () => loadConversations().catch((err) => setError(err.message));
    const onMemberRemoved = ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      if (conversationId === selectedId && userId === currentUser.id) {
        setSelectedId('');
      }
      loadConversations().catch((err) => setError(err.message));
    };
    socket.on('dm:message:new', onMessage);
    socket.on('dm:conversation:update', onConversationUpdate);
    socket.on('dm:member:removed', onMemberRemoved);
    return () => {
      socket.off('dm:message:new', onMessage);
      socket.off('dm:conversation:update', onConversationUpdate);
      socket.off('dm:member:removed', onMemberRemoved);
    };
  }, [selectedId, socket, currentUser.id]);

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
      ? `@${selected.otherUser.username}`
      : '';

  return (
    <div className="dm-page">
      <aside className="dm-sidebar">
        <header><button onClick={onBack}><ArrowLeft /></button><strong>Mensagens</strong></header>
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
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <ConversationAvatar conversation={conversation} />
                  <div>
                    <strong>{conversation.isGroup ? conversation.name : `@${conversation.otherUser?.username}`}</strong>
                    <small>{conversation.lastMessage?.content || `${conversation.members.length} membro${conversation.members.length === 1 ? '' : 's'}`}</small>
                  </div>
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
        <div className="dm-current-user"><UserAvatar user={currentUser} /><strong>@{currentUser.username}</strong></div>
      </aside>
      <main className="chat-panel">
        {selected ? (
          <>
            <header className="chat-header">
              <button
                className="profile-name"
                onClick={() => selected.otherUser && openProfile(selected.otherUser.username)}
              >
                <ConversationAvatar conversation={selected} />
                <strong>{title}</strong>
              </button>
              {selected.isGroup && <span>{selected.members.length}/10 membros</span>}
              <button className="push-right call-action" onClick={() => setCallMode('audio')} title="Chamada de voz"><Mic /></button>
              <button className="call-action" onClick={() => setCallMode('video')} title="Chamada de vídeo"><Video /></button>
              <button className="call-action" onClick={() => setSearchOpen((current) => !current)} title="Pesquisar"><SearchIcon /></button>
              {selected.isGroup && <button className="call-action" onClick={() => setDialog('members')} title="Membros"><Users /></button>}
            </header>
            {callMode ? (
              <CallRoom
                name={title}
                tokenEndpoint={`/direct-conversations/${selected.id}/call-token`}
                videoEnabled={callMode === 'video'}
              />
            ) : (
              <>
                <section className="messages">
                  <div className="channel-intro">
                    <div>{selected.isGroup ? <Users /> : <MessageCircle />}</div>
                    <h1>{title}</h1>
                    <p>{selected.isGroup ? `Grupo privado com ${selected.members.length} membros.` : 'Esta é uma conversa privada entre amigos.'}</p>
                  </div>
                  {messages.map((message) => (
                    <MessageRow
                      key={message.id}
                      message={message}
                      onReply={setReplyingTo}
                      onForward={setForwardingMessage}
                      onProfile={(author) => openProfile(author.username)}
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
            <p className="muted">Seleciona entre 2 e 9 amigos. Contigo, o grupo pode ter no máximo 10 membros.</p>
            <div className="dialog-list selectable">
              {friends.friends.map((friend) => (
                <button type="button" className={selectedFriends.includes(friend.id) ? 'selected' : ''} key={friend.id} onClick={() => toggleGroupFriend(friend.id)}>
                  <UserAvatar user={friend} />
                  <strong>@{friend.username}</strong>
                  <span className="selection-check">{selectedFriends.includes(friend.id) && <Check />}</span>
                </button>
              ))}
            </div>
            <button className="primary" disabled={selectedFriends.length < 2 || selectedFriends.length > 9}>Criar grupo ({selectedFriends.length + 1}/10)</button>
          </form>
        </div>
      )}

      {dialog === 'members' && selected?.isGroup && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section className="dialog-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setDialog(null)}><X /></button>
            <span className="eyebrow">MEMBROS</span>
            <h2>{selected.name}</h2>
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
                  {member.id !== selected.ownerId && (selected.ownerId === currentUser.id || member.id === currentUser.id) && (
                    <button onClick={() => removeGroupMember(member.id)} title={member.id === currentUser.id ? 'Sair do grupo' : 'Remover membro'}><UserMinus /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
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
