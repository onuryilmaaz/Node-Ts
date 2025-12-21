export type AccessTokenPayload = {
  userId: string;
  email: string;
  roles: string[];
  emailVerified: boolean;
  isActive: boolean;
};
