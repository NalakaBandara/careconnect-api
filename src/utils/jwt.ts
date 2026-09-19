import "dotenv/config";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

// Fail fast at startup rather than issuing/verifying tokens with an undefined secret
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}

export interface AccessTokenPayload {
    sub: string;
    email: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload =>
    jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
