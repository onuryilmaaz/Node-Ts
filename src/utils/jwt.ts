import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";
import type { StringValue } from "ms";
import type { AccessTokenPayload, ChildTokenPayload } from "../types/auth";

const ACCESS_SECRET: Secret = process.env.JWT_ACCESS_SECRET as Secret;

const signOptions: SignOptions = {
  expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as StringValue,
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, ACCESS_SECRET, signOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function signChildToken(payload: ChildTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "4h" as StringValue });
}

export function verifyChildToken(token: string): ChildTokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET) as ChildTokenPayload;
  if (decoded.type !== "child_session") throw new Error("Invalid token type");
  return decoded;
}
