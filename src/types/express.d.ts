export {};

// Augments Express's Request with the payload set by checkJwt (src/middleware/auth0.middleware.ts)
declare global {
    namespace Express {
        interface Request {
            auth?: {
                payload: {
                    sub: string;
                    email?: string;
                    [key: string]: unknown;
                };
            };
        }
    }
}
