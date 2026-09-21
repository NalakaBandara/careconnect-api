import newrelic from "newrelic";
import { logger } from "../config/logger.js";

export const logError = (message: string, error: unknown, context: Record<string, unknown> = {}) => {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error({ err: { type: err.name, message: err.message, stack: err.stack }, ...context }, message);
    newrelic.noticeError(err, context as any);
};
