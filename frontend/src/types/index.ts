export interface ChatMeta {
  id: string;
  title: string;
  createdAt: number;
}

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  email_verified: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  user: UserProfile;
}
