import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";

import { logger } from "../config/logger.js";

// One log line per request. Only safe fields are logged (no headers, no body).
export const requestLogger = pinoHttp({
    logger,
    genReqId: (req, res) => {
        const id = (req.headers["x-request-id"] as string) || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
    },
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },
    // Render pings /health constantly; don't log it
    autoLogging: { ignore: (req) => req.url === "/health" },
    serializers: {
        req: (req: any) => ({ id: req.id, method: req.method, url: req.url, ip: req.ip }),
        res: (res: any) => ({ statusCode: res.statusCode }),
    },
});
