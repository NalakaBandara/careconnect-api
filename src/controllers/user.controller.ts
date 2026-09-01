import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const getMyProfile = async (req: Request, res: Response) => {
    try {
        const auth0UserId = req.auth?.payload?.sub;

        if (!auth0UserId) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User identity not found in access token",
                },
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                auth0UserId,
            },
            include: {
                userRoles: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({
                error: {
                    code: "USER_NOT_FOUND",
                    message: "CareConnect user not found",
                },
            });
        }

        return res.status(200).json({
            data: {
                id: user.id.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                dateOfBirth: user.dateOfBirth,
                phone: user.phone,
                profilePhoto: user.profilePhoto,
                status: user.status,
                roles: user.userRoles.map(
                    (userRole) => userRole.role.name
                ),
            },
        });
    } catch (error) {
        console.error("Get my profile failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve user profile",
            },
        });
    }
};