// Central registry of OAuth2 scopes granted to M2M (client_credentials) callers.
// Authorize by checking these against the token's `scope` claim in code -
// avoids depending on Auth0's dashboard RBAC/permissions add-on.
export const SCOPES = {
    READ_SYSTEM: "read:system",
    READ_USERS: "read:users",
    WRITE_USERS: "write:users",
    READ_APPOINTMENTS: "read:appointments",
    WRITE_APPOINTMENTS: "write:appointments",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];
