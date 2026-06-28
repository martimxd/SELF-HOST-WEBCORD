export type User = {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  suspended?: boolean;
  createdAt?: string;
  avatarUrl?: string | null;
  status?: 'online' | 'offline';
  presenceMode?: 'ONLINE' | 'INVISIBLE';
  bio?: string;
  customStatus?: string;
  activeCall?: {
    label: string;
    kind: 'server' | 'direct';
    targetId: string;
  } | null;
  relationship?: 'self' | 'friend' | 'pending' | 'none' | 'blocked';
  serverJoinedAt?: string;
};

export type Channel = {
  id: string;
  serverId?: string;
  name: string;
  type: 'TEXT' | 'VOICE' | 'VIDEO';
  position?: number;
  category?: string | null;
  isPrivate?: boolean;
  isReadOnly?: boolean;
};

export type ServerPermission =
  | 'ADMINISTRATOR'
  | 'MANAGE_SERVER'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_ROLES'
  | 'KICK_MEMBERS'
  | 'BAN_MEMBERS'
  | 'MANAGE_MESSAGES'
  | 'MENTION_EVERYONE'
  | 'SEND_MESSAGES'
  | 'READ_MESSAGES'
  | 'ATTACH_FILES'
  | 'JOIN_CALL'
  | 'SPEAK_IN_CALL'
  | 'MUTE_MEMBERS'
  | 'DEAFEN_MEMBERS';

export type ServerRole = {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: ServerPermission[];
};

export type Server = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  permissions?: ServerPermission[];
  channels: Channel[];
  roles?: ServerRole[];
  members: Array<{
    id: string;
    role: string;
    nickname?: string | null;
    timeoutUntil?: string | null;
    joinedAt: string;
    permissions?: ServerPermission[];
    roleAssignments?: Array<{ id: string; role: ServerRole }>;
    user: User;
  }>;
  bans?: Array<{ id: string; createdAt: string; reason?: string | null; user: User; moderator?: User | null }>;
  moderationLogs?: Array<{
    id: string;
    action: string;
    details: string;
    targetUserId?: string | null;
    createdAt: string;
    actor?: User | null;
  }>;
};

export type Message = {
  id: string;
  channelId?: string;
  conversationId?: string;
  content: string;
  createdAt: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl' | 'status'>;
  forwardedFrom?: string | null;
  reactions?: Array<{
    emoji: string;
    count: number;
    userIds: string[];
  }>;
  replyTo?: {
    id: string;
    content: string;
    author: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  } | null;
};

export type DirectConversation = {
  id: string;
  name: string;
  isGroup: boolean;
  ownerId: string | null;
  members: Array<Pick<User, 'id' | 'username' | 'createdAt' | 'avatarUrl' | 'status'>>;
  otherUser: Pick<User, 'id' | 'username' | 'createdAt' | 'avatarUrl' | 'status'> | null;
  nickname: string | null;
  imageUrl: string | null;
  lastMessage: { content: string; createdAt: string } | null;
  updatedAt: string;
};

export type MessagePage = {
  messages: Message[];
  nextCursor: string | null;
};

export type FriendRequest = {
  id: string;
  user: User;
};

export type FriendsPayload = {
  friends: User[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  blocked: User[];
};

export type Sticker = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string;
};

export type GiphyGif = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  analyticsOnSend: string;
};

export type GifFavorite = {
  id: string;
  gifId: string;
  title: string;
  url: string;
  previewUrl: string;
  source: string;
  createdAt: string;
};
