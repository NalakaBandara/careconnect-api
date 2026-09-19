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
        const { isRead } = req.query;

        const where: any = { userId: currentUser.id };

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
        console.error("List notifications failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve notifications",
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

        const { isRead } = req.body;

        if (typeof isRead !== "boolean") {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "isRead is required and must be a boolean",
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
        console.error("Update notification failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update notification",
            },
        });
    }
};
