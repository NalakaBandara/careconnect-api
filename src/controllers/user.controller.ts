import { logError } from "../utils/logError.js";
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";
import { fieldErrorResponse } from "../utils/errors.js";

// ADMIN, or the account's own owner, may anonymise it
const canManageUser = (currentUser: any, targetUserId: bigint): boolean => {
    const roleNames: string[] =
        currentUser?.userRoles?.map((userRole: any) => userRole.role.name) ?? [];

    if (roleNames.includes("ADMIN")) {
        return true;
    }

    return currentUser?.id === targetUserId;
};

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
        logError("List users failed:", error);

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

        logError("Create user failed:", error);

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

        logError("Update my profile failed:", error);

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
        logError("Get user by id failed:", error);

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

        logError("Update user by id failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update user",
            },
        });
    }
};

// PATCH /:id?anonymisation=true - ADMIN, or the account owner, scrubs the user's PII in place.
// The row itself (and every appointment/audit-log/etc. that references it) is kept for
// referential integrity; only the personal fields are overwritten.
export const anonymiseUser = async (req: Request, res: Response) => {
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

        if (req.query.anonymisation !== "true") {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "anonymisation=true query parameter is required to use this endpoint",
                },
            });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });

        if (!targetUser) {
            return res.status(404).json({
                error: {
                    code: "USER_NOT_FOUND",
                    message: "CareConnect user not found",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!canManageUser(currentUser, userId)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to anonymise this user",
                },
            });
        }

        if (targetUser.anonymisedAt) {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This user has already been anonymised",
                },
            });
        }

        const anonymisedAt = new Date();

        const [anonymised] = await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: {
                    // Deterministic from the id, so it can never collide with a real or another
                    // anonymised user's email, even though email is unique and non-nullable.
                    email: `deleted-user-${userId.toString()}@anonymised.local`,
                    firstName: "Redacted",
                    lastName: "User",
                    dateOfBirth: null,
                    phone: null,
                    profilePhoto: null,
                    nic: null,
                    nicPhoto: null,
                    // Nulling this blocks login: auth.controller's login() treats a missing
                    // passwordHash the same as a wrong password.
                    passwordHash: null,
                    status: "ANONYMISED",
                    anonymisedAt,
                },
            }),
            prisma.auditLog.create({
                data: {
                    userId: currentUser.id,
                    action: "ANONYMISE",
                    entityType: "User",
                    entityId: userId,
                },
            }),
        ]);

        return res.status(200).json({
            data: {
                id: anonymised.id.toString(),
                status: anonymised.status,
                anonymisedAt: anonymised.anonymisedAt?.toISOString() ?? null,
            },
        });
    } catch (error) {
        logError("Anonymise user failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to anonymise user",
            },
        });
    }
};
