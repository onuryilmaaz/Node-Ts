import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";
import type { StringValue } from "ms";
import type { AccessTokenPayload } from "../types/auth";

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
