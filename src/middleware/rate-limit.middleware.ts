import "dotenv/config";
import { Request } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// In-memory store: correct while the API runs as a single instance (Render free plan).
// Move to a shared store (e.g. rate-limit-redis) before scaling to more than one instance,
// otherwise each instance counts separately and the effective limit multiplies.

const MINUTE = 60 * 1000;

// Same error envelope as the rest of the API. Retry-After / RateLimit-* headers are added by the library.
const limited = (message: string) => ({
    error: {
        code: "RATE_LIMITED",
        message,
    },
});

const baseOptions = {
    standardHeaders: "draft-7" as const,
    legacyHeaders: false,
};

// req.ip is only the real client IP when 'trust proxy' is set correctly in app.ts
const clientIp = (req: Request) => ipKeyGenerator(req.ip ?? "");

const emailFromBody = (req: Request): string => {
    const email = req.body?.email;

    return typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : "";
};

// Flood guard for every /api request; rejects before any auth or DB work happens.
// Generous on purpose: many mobile users can share one carrier IP.
export const apiLimiter = rateLimit({
    ...baseOptions,
    windowMs: MINUTE,
    limit: 300,
    message: limited("Too many requests, please try again later"),
});

// Available slots costs two queries per call, so it gets a tighter limit than plain browsing.
export const slotsLimiter = rateLimit({
    ...baseOptions,
    windowMs: MINUTE,
    limit: 30,
    message: limited("Too many availability requests, please try again shortly"),
});

// Login, layer 1: many attempts from one IP (password spraying across accounts).
// Only failed attempts (status >= 400) count, so normal logins are never throttled by it.
export const loginIpLimiter = rateLimit({
    ...baseOptions,
    windowMs: 15 * MINUTE,
    limit: 50,
    skipSuccessfulRequests: true,
    message: limited("Too many login attempts, please try again later"),
});

// Login, layer 2: many attempts against one account from one IP (password guessing).
export const loginAccountLimiter = rateLimit({
    ...baseOptions,
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${clientIp(req)}:${emailFromBody(req)}`,
    message: limited("Too many login attempts for this account, please try again later"),
});

// Register runs bcrypt and creates rows, so cap it per IP.
export const registerLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * MINUTE,
    limit: 5,
    message: limited("Too many registration attempts, please try again later"),
});
