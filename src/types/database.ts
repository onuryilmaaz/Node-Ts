export interface DbUser {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  avatar_public_id: string | null;
  auth_provider: string;
  provider_id: string | null;
  password_hash: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DbSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  user_agent: string | null;
}

export interface DbRole {
  id: string;
  name: string;
  created_at: Date;
}

export interface DbUserRole {
  user_id: string;
  role_id: string;
  assigned_at: Date;
}

export interface DbOtp {
  id: string;
  email: string;
  code: string;
  type: 'email_verification' | 'password_reset';
  expires_at: Date;
  created_at: Date;
  is_used: boolean;
}
