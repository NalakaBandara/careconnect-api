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

const serializeSpecialty = (specialty: any) => ({
    id: specialty.id.toString(),
    name: specialty.name,
    description: specialty.description,
});

export const getSpecialties = async (req: Request, res: Response) => {
    try {
        const specialties = await prisma.specialty.findMany({
            orderBy: { id: "asc" },
        });

        return res.status(200).json({
            data: specialties.map(serializeSpecialty),
        });
    } catch (error) {
        logError("List specialties failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve specialties",
            },
        });
    }
};

export const createSpecialty = async (req: Request, res: Response) => {
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

        const specialty = await prisma.specialty.create({
            data: {
                name,
                description: description || null,
            },
        });

        return res.status(201).json(serializeSpecialty(specialty));
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "A specialty with this name already exists",
                },
            });
        }

        logError("Create specialty failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create specialty",
            },
        });
    }
};

export const updateSpecialty = async (req: Request, res: Response) => {
    try {
        const specialtyId = parseId(req.params.id);

        if (specialtyId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "name is required",
                },
            });
        }

        const specialty = await prisma.specialty.update({
            where: { id: specialtyId },
            data: {
                name,
                description: description || null,
            },
        });

        return res.status(200).json(serializeSpecialty(specialty));
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Specialty not found",
                },
            });
        }

        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "A specialty with this name already exists",
                },
            });
        }

        logError("Update specialty failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update specialty",
            },
        });
    }
};
