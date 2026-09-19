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

export const createMyProfile = async (req: Request, res: Response) => {
    try {
        const auth0UserId = req.auth?.payload?.sub;
        const email = (req.auth?.payload?.email as string | undefined) || req.body.email;

        if (!auth0UserId) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User identity not found in access token",
                },
            });
        }

        if (!email) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "email is required",
                },
            });
        }

        const {
            firstName,
            lastName,
            dateOfBirth,
            phone,
        } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "firstName and lastName are required",
                },
            });
        }

        const patientRole = await prisma.role.findUnique({
            where: {
                name: "PATIENT",
            },
        });

        if (!patientRole) {
            return res.status(500).json({
                error: {
                    code: "ROLE_NOT_FOUND",
                    message: "PATIENT role not configured",
                },
            });
        }

        const user = await prisma.user.create({
            data: {
                auth0UserId,
                email,
                firstName,
                lastName,
                dateOfBirth: dateOfBirth
                    ? new Date(dateOfBirth)
                    : null,
                phone: phone || null,
                userRoles: {
                    create: {
                        roleId: patientRole.id,
                    },
                },
            },
            include: {
                userRoles: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        return res.status(201).json({
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
        console.error("Create my profile failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create user profile",
            },
        });
    }
};

export const updateMyProfile = async (req: Request, res: Response) => {
    try {
        // loadCurrentUser has already resolved and attached the DB row
        const currentUser = res.locals.user;

        const {
            firstName,
            lastName,
            dateOfBirth,
            phone,
            profilePhoto,
            nic,
            nicPhoto,
        } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "firstName and lastName are required",
                },
            });
        }

        const user = await prisma.user.update({
            where: {
                id: currentUser.id,
            },
            data: {
                firstName,
                lastName,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                phone: phone || null,
                profilePhoto: profilePhoto || null,
                nic: nic || null,
                nicPhoto: nicPhoto || null,
            },
            include: {
                userRoles: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        return res.status(200).json({
            data: {
                id: user.id.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                dateOfBirth: user.dateOfBirth,
                phone: user.phone,
                profilePhoto: user.profilePhoto,
                nic: user.nic,
                nicPhoto: user.nicPhoto,
                status: user.status,
                roles: user.userRoles.map(
                    (userRole) => userRole.role.name
                ),
            },
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "NIC is already registered to another user",
                },
            });
        }

        console.error("Update my profile failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update user profile",
            },
        });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        let userId: bigint;

        try {
            userId = BigInt(id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId,
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
        console.error("Get user by id failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve user",
            },
        });
    }
};
