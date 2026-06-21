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
  relationship?: 'self' | 'friend' | 'pending' | 'none' | 'blocked';
  serverJoinedAt?: string;
};

export type Channel = {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE' | 'VIDEO';
};

export type Server = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  channels: Channel[];
  members: Array<{ id: string; role: string; joinedAt: string; user: User }>;
};

export type Message = {
  id: string;
  conversationId?: string;
  content: string;
  createdAt: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl' | 'status'>;
  forwardedFrom?: string | null;
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
  lastMessage: { content: string; createdAt: string } | null;
  updatedAt: string;
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
