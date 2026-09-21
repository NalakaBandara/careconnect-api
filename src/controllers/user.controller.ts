import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";
import { fieldErrorResponse } from "../utils/errors.js";

export const getMyProfile = async (req: Request, res: Response) => {
    // loadCurrentUser has already resolved and attached the DB row (with roles)
    const user = res.locals.user;

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
                (userRole: any) => userRole.role.name
            ),
        },
    });
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        const where: any = {};

        if (typeof status === "string") {
            where.status = status;
        }

        const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
        const pageSize = Math.min(
            Math.max(parseInt(req.query.pageSize as string, 10) || 20, 1),
            100
        );

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                orderBy: { id: "asc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    userRoles: {
                        include: {
                            role: true,
                        },
                    },
                },
            }),
            prisma.user.count({ where }),
        ]);

        return res.status(200).json({
            data: users.map((user) => ({
                id: user.id.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                status: user.status,
                roles: user.userRoles.map((userRole) => userRole.role.name),
            })),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("List users failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve users",
            },
        });
    }
};

// ADMIN-only provisioning; sets an initial password directly instead of relying on an IdP callback
export const createUser = async (req: Request, res: Response) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            dateOfBirth,
            phone,
            nic,
            status,
        } = req.body;

        if (!email || !password || !firstName || !lastName) {
            const fields: Record<string, string[]> = {};

            if (!email) fields.email = ["Email is required"];
            if (!password) fields.password = ["Password is required"];
            if (!firstName) fields.firstName = ["First name is required"];
            if (!lastName) fields.lastName = ["Last name is required"];

            return res
                .status(400)
                .json(fieldErrorResponse(fields, "email, password, firstName and lastName are required"));
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

        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                phone: phone || null,
                nic: nic || null,
                status: status || "ACTIVE",
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
                nic: user.nic,
                profilePhoto: user.profilePhoto,
                status: user.status,
                roles: user.userRoles.map(
                    (userRole) => userRole.role.name
                ),
            },
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            const target: string[] = error?.meta?.target ?? [];
            const fields: Record<string, string[]> = {};

            if (target.includes("email")) fields.email = ["Email already registered"];
            if (target.includes("nic")) fields.nic = ["NIC already registered"];

            return res
                .status(409)
                .json(
                    fieldErrorResponse(
                        Object.keys(fields).length ? fields : { email: ["Email or NIC already registered"] },
                        "A user with this email or NIC already exists",
                        "CONFLICT"
                    )
                );
        }

        console.error("Create user failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create user",
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

export const updateUserById = async (req: Request, res: Response) => {
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

        const {
            firstName,
            lastName,
            dateOfBirth,
            phone,
            profilePhoto,
            nic,
            nicPhoto,
            status,
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
                id: userId,
            },
            data: {
                firstName,
                lastName,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                phone: phone || null,
                profilePhoto: profilePhoto || null,
                nic: nic || null,
                nicPhoto: nicPhoto || null,
                status: status || undefined,
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
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "USER_NOT_FOUND",
                    message: "CareConnect user not found",
                },
            });
        }

        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "NIC is already registered to another user",
                },
            });
        }

        console.error("Update user by id failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update user",
            },
        });
    }
};
