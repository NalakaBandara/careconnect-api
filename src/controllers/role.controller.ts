import { logError } from "../utils/logError.js";
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

const serializeRole = (role: any) => ({
    id: role.id.toString(),
    name: role.name,
    description: role.description,
});

export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { id: "asc" },
        });

        return res.status(200).json({
            data: roles.map(serializeRole),
        });
    } catch (error) {
        logError("List roles failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve roles",
            },
        });
    }
};

export const createRole = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "name is required",
                },
            });
        }

        const role = await prisma.role.create({
            data: {
                name,
                description: description || null,
            },
        });

        return res.status(201).json(serializeRole(role));
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "A role with this name already exists",
                },
            });
        }

        logError("Create role failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create role",
            },
        });
    }
};

export const assignUserRole = async (req: Request, res: Response) => {
    try {
        const { userId, roleId } = req.body;

        let parsedUserId: bigint;
        let parsedRoleId: bigint;

        try {
            parsedUserId = BigInt(userId);
            parsedRoleId = BigInt(roleId);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "userId and roleId are required and must be valid numeric identifiers",
                },
            });
        }

        const [user, role] = await Promise.all([
            prisma.user.findUnique({ where: { id: parsedUserId } }),
            prisma.role.findUnique({ where: { id: parsedRoleId } }),
        ]);

        if (!user || !role) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "User or role not found",
                },
            });
        }

        await prisma.userRole.create({
            data: {
                userId: parsedUserId,
                roleId: parsedRoleId,
            },
        });

        return res.status(201).json({
            userId: parsedUserId.toString(),
            roleId: parsedRoleId.toString(),
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This role is already assigned to this user",
                },
            });
        }

        logError("Assign user role failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to assign role to user",
            },
        });
    }
};
