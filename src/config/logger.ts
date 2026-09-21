import pino from "pino";

// JSON logger. The New Relic agent forwards pino output automatically.
// redact keeps secrets out of anything that reaches New Relic.
export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash"],
});
