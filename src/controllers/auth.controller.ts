import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { fieldErrorResponse } from "../utils/errors.js";

const serializeAuthUser = (user: any) => ({
    id: user.id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    roles: user.userRoles.map((userRole: any) => userRole.role.name),
});

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, lastName, dateOfBirth, phone } = req.body;

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

        if (password.length < 8) {
            return res
                .status(400)
                .json(
                    fieldErrorResponse(
                        { password: ["Password must be at least 8 characters"] },
                        "password must be at least 8 characters"
                    )
                );
        }

        const patientRole = await prisma.role.findUnique({ where: { name: "PATIENT" } });

        if (!patientRole) {
            return res.status(500).json({
                error: { code: "ROLE_NOT_FOUND", message: "PATIENT role not configured" },
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
                userRoles: {
                    create: { roleId: patientRole.id },
                },
            },
            include: { userRoles: { include: { role: true } } },
        });

        const accessToken = signAccessToken({ sub: user.id.toString(), email: user.email });

        return res.status(201).json({
            data: serializeAuthUser(user),
            accessToken,
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res
                .status(409)
                .json(
                    fieldErrorResponse(
                        { email: ["Email already registered"] },
                        "A user with this email already exists",
                        "CONFLICT"
                    )
                );
        }

        console.error("Register failed:", error);

        return res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to register user" },
        });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            const fields: Record<string, string[]> = {};

            if (!email) fields.email = ["Email is required"];
            if (!password) fields.password = ["Password is required"];

            return res.status(400).json(fieldErrorResponse(fields, "email and password are required"));
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { userRoles: { include: { role: true } } },
        });

        // Same message for unknown email and wrong password - don't leak which one was wrong
        if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
            });
        }

        const accessToken = signAccessToken({ sub: user.id.toString(), email: user.email });

        return res.status(200).json({
            data: serializeAuthUser(user),
            accessToken,
        });
    } catch (error) {
        console.error("Login failed:", error);

        return res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to login" },
        });
    }
};
