import { Request, Response, NextFunction } from "express";
import { checkJwt } from "./auth0.middleware.js";
import { loadCurrentUser } from "./current-user.middleware.js";

// For public browse routes (GET only).
// No Authorization header = guest. If a header IS sent, the token must be valid.
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
    // The same URL serves two audiences, so keep caches from mixing them up
    res.setHeader("Vary", "Authorization");

    // Only the server decides guest status, never a value the client sends
    if (!req.header("authorization")) {
        res.locals.isGuest = true;
        res.setHeader("Cache-Control", "public, max-age=60");
        return next();
    }

    // Logged-in responses can hold fields guests never see: never store them in a shared cache
    res.setHeader("Cache-Control", "private, no-cache");

    // A token was sent, so verify it: bad or expired tokens still get a 401
    checkJwt(req, res, (err?: any) => {
        if (err) return next(err);
        loadCurrentUser(req, res, next);
    });
};
