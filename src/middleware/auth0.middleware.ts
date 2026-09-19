import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";

// Defaults to enabled (safe) unless explicitly set to "false".
const isAuthEnabled = process.env.AUTH_ENABLED !== "false";

// Hard block: this switch must never reach production, disabled or not.
if (!isAuthEnabled && process.env.NODE_ENV === "production") {
    throw new Error(
        "AUTH_ENABLED=false is not allowed when NODE_ENV=production"
    );
}

// Verifies our own JWTs (src/utils/jwt.ts, issued by /api/v1/auth/register + /login)
export const checkJwt = (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthEnabled) {
        console.warn(
            "AUTH DISABLED (AUTH_ENABLED=false) - checkJwt bypassed, do not deploy like this"
        );

        // DEV_USER_SUB must be a numeric user id now (loadCurrentUser looks up by id, not auth0UserId)
        const sub = (req.header("x-dev-user-sub") as string) || process.env.DEV_USER_SUB || "1";
        const email =
            (req.header("x-dev-user-email") as string) ||
            process.env.DEV_USER_EMAIL ||
            "dev-local-user@example.com";

        (req as any).auth = { payload: { sub, email } };

        return next();
    }

    const authHeader = req.header("authorization") || req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
            error: {
                code: "UNAUTHORIZED",
                message: "Missing or malformed Authorization header",
            },
        });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    try {
        const payload = verifyAccessToken(token);

        (req as any).auth = { payload };

        next();
    } catch {
        return res.status(401).json({
            error: {
                code: "UNAUTHORIZED",
                message: "Invalid or expired token",
            },
        });
    }
};
