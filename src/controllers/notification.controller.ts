import { logError } from "../utils/logError.js";
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

const serializeNotification = (notification: any) => ({
    id: notification.id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
});

export const getMyNotifications = async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.user;
        const { isRead, userId } = req.query;

        const where: any = { userId: currentUser.id };

        // ADMIN can view another user's notifications via ?userId=; everyone else is scoped to themselves
        if (userId) {
            const roleNames: string[] =
                currentUser?.userRoles?.map((userRole: any) => userRole.role.name) ?? [];

            if (!roleNames.includes("ADMIN")) {
                return res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message: "Only ADMIN can view another user's notifications",
                    },
                });
            }

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

        if (isRead !== undefined) {
            where.isRead = isRead === "true";
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({
            data: notifications.map(serializeNotification),
        });
    } catch (error) {
        logError("List notifications failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve notifications",
            },
        });
    }
};

export const createNotification = async (req: Request, res: Response) => {
    try {
        const { userId, type, title, message } = req.body;

        const parsedUserId = parseId(userId);

        if (parsedUserId === null || !type || !title || !message) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "userId, type, title and message are required",
                },
            });
        }

        const user = await prisma.user.findUnique({ where: { id: parsedUserId } });

        if (!user) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "User not found",
                },
            });
        }

        const notification = await prisma.notification.create({
            data: {
                userId: parsedUserId,
                type,
                title,
                message,
            },
        });

        return res.status(201).json(serializeNotification(notification));
    } catch (error) {
        logError("Create notification failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create notification",
            },
        });
    }
};

export const markNotificationRead = async (req: Request, res: Response) => {
    try {
        const notificationId = parseId(req.params.id);

        if (notificationId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        const existingNotification = await prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!existingNotification || existingNotification.userId !== currentUser.id) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Notification not found",
                },
            });
        }

        // Body is optional: PATCH /:id/read means "mark as read" unless isRead: false is sent explicitly
        const isRead = req.body?.isRead ?? true;

        if (typeof isRead !== "boolean") {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "isRead must be a boolean when provided",
                },
            });
        }

        const notification = await prisma.notification.update({
            where: { id: notificationId },
            data: {
                isRead,
                readAt: isRead ? new Date() : null,
            },
        });

        return res.status(200).json(serializeNotification(notification));
    } catch (error) {
        logError("Update notification failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update notification",
            },
        });
    }
};
