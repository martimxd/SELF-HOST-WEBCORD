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
  channels: Channel[];
  members: Array<{ id: string; role: string; user: User }>;
};

export type Message = {
  id: string;
  conversationId?: string;
  content: string;
  createdAt: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl' | 'status'>;
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
};
