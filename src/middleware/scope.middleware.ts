import { Request, Response, NextFunction } from "express";

// Auth0 client-credentials (M2M) tokens always have a `sub` of `{client_id}@clients`.
export const isM2MToken = (req: Request): boolean => {
    const sub = req.auth?.payload?.sub;

    return typeof sub === "string" && sub.endsWith("@clients");
};

const getTokenScopes = (req: Request): string[] => {
    const scope = req.auth?.payload?.scope;

    return typeof scope === "string" ? scope.split(" ") : [];
};

// Authorizes M2M (and optionally user) tokens against scopes granted in Auth0
// Client Grants, checked here in code instead of relying on Auth0 RBAC.
export const requireScopes = (...requiredScopes: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const tokenScopes = getTokenScopes(req);

        const hasAllScopes = requiredScopes.every((scope) =>
            tokenScopes.includes(scope)
        );

        if (!hasAllScopes) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: `Token is missing required scope(s): ${requiredScopes.join(", ")}`,
                },
            });
        }

        next();
    };
};

// Blocks M2M callers without requiring a DB User row to already exist -
// use this (instead of loadCurrentUser) on self-service signup endpoints.
export const rejectM2MTokens = (req: Request, res: Response, next: NextFunction) => {
    if (isM2MToken(req)) {
        return res.status(403).json({
            error: {
                code: "FORBIDDEN",
                message: "Machine-to-machine tokens cannot access user endpoints",
            },
        });
    }

    next();
};

