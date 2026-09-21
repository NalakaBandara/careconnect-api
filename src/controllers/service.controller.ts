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

const serializeService = (service: any) => ({
    id: service.id.toString(),
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    status: service.status,
});

export const getServices = async (req: Request, res: Response) => {
    try {
        const { clinicId, doctorId } = req.query;
        const isGuest = res.locals.isGuest === true;

        const where: any = {};

        if (clinicId) {
            const parsedClinicId = parseId(clinicId as string);

            if (parsedClinicId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "clinicId must be a valid numeric identifier",
                    },
                });
            }

            where.clinicServices = { some: { clinicId: parsedClinicId } };
        }

        if (doctorId) {
            const parsedDoctorId = parseId(doctorId as string);

            if (parsedDoctorId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "doctorId must be a valid numeric identifier",
                    },
                });
            }

            where.doctorServices = { some: { doctorProfileId: parsedDoctorId } };
        }

        if (isGuest) {
            // Guests only ever see ACTIVE services
            where.status = "ACTIVE";
        }

        const services = await prisma.service.findMany({
            where,
            orderBy: { id: "asc" },
        });

        return res.status(200).json({
            data: services.map(serializeService),
        });
    } catch (error) {
        logError("List services failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve services",
            },
        });
    }
};

export const getServiceById = async (req: Request, res: Response) => {
    try {
        const serviceId = parseId(req.params.id);

        if (serviceId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const service = await prisma.service.findUnique({ where: { id: serviceId } });

        if (!service) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Service not found",
                },
            });
        }

        return res.status(200).json(serializeService(service));
    } catch (error) {
        logError("Get service failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve service",
            },
        });
    }
};

export const createService = async (req: Request, res: Response) => {
    try {
        const { name, description, durationMinutes, status } = req.body;

        if (!name) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "name is required",
                },
            });
        }

        const service = await prisma.service.create({
            data: {
                name,
                description: description || null,
                durationMinutes: durationMinutes ?? null,
                status: status || "ACTIVE",
            },
        });

        return res.status(201).json(serializeService(service));
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "A service with this name already exists",
                },
            });
        }

        logError("Create service failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create service",
            },
        });
    }
};

export const updateService = async (req: Request, res: Response) => {
    try {
        const serviceId = parseId(req.params.id);

        if (serviceId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const { name, description, durationMinutes, status } = req.body;

        if (!name) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "name is required",
                },
            });
        }

        const service = await prisma.service.update({
            where: { id: serviceId },
            data: {
                name,
                description: description || null,
                durationMinutes: durationMinutes ?? null,
                status: status || "ACTIVE",
            },
        });

        return res.status(200).json(serializeService(service));
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Service not found",
                },
            });
        }

        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "A service with this name already exists",
                },
            });
        }

        logError("Update service failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update service",
            },
        });
    }
};
