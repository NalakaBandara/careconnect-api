import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

const parseId = (value: string | string[] | undefined): bigint | null => {
    if (typeof value !== "string") {
        return null;
    }

    try {
        return BigInt(value);
    } catch {
        return null;
    }
};

export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const { userId, entityType } = req.query;

        const where: any = {};

        if (userId) {
            const parsedUserId = parseId(userId as string | string[] | undefined);

            if (parsedUserId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "userId must be a valid numeric identifier",
                    },
                });
            }

            where.userId = parsedUserId;
        }

        if (typeof entityType === "string") {
            where.entityType = entityType;
        }

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 200,
        });

        return res.status(200).json({
            data: logs.map((log) => ({
                id: log.id.toString(),
                userId: log.userId ? log.userId.toString() : null,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId ? log.entityId.toString() : null,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                metadata: log.metadata,
                createdAt: log.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("List audit logs failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve audit logs",
            },
        });
    }
};
