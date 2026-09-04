import { auth } from "express-oauth2-jwt-bearer";
import { Request, Response, NextFunction } from "express";

// Defaults to enabled (safe) unless explicitly set to "false".
const isAuthEnabled = process.env.AUTH_ENABLED !== "false";

// Hard block: this switch must never reach production, disabled or not.
if (!isAuthEnabled && process.env.NODE_ENV === "production") {
    throw new Error(
        "AUTH_ENABLED=false is not allowed when NODE_ENV=production"
    );
}

const verifyJwt = auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
    tokenSigningAlg: "RS256",
});

export const checkJwt = (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthEnabled) {
        console.warn(
            "AUTH DISABLED (AUTH_ENABLED=false) - checkJwt bypassed, do not deploy like this"
        );

        // Per-request override lets you simulate different users without restarting the server
        const sub =
            (req.header("x-dev-user-sub") as string) ||
            process.env.DEV_USER_SUB ||
            "auth0|dev-local-user";
        const email =
            (req.header("x-dev-user-email") as string) ||
            process.env.DEV_USER_EMAIL ||
            `${sub.replace(/[^a-zA-Z0-9]/g, "-")}@example.com`;

        (req as any).auth = {
            payload: {
                sub,
                email,
                scope: process.env.DEV_USER_SCOPE || "",
            },
        };

        return next();
    }

    return verifyJwt(req, res, next);
};