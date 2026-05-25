export type AccessTokenPayload = {
  userId: string;
  email: string;
  roles: string[];
  emailVerified: boolean;
  isActive: boolean;
};

export type ChildTokenPayload = {
  childId: string;
  parentId: string;
  type: "child_session";
};
