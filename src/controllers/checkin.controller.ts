import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { canAccessAppointment } from "./appointment.controller.js";

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

const serializeCheckIn = (checkIn: any) => ({
    id: checkIn.id.toString(),
    appointmentId: checkIn.appointmentId.toString(),
    checkedInAt: checkIn.checkedInAt.toISOString(),
    checkedInByUserId: checkIn.checkedInByUserId.toString(),
    method: checkIn.method,
    queueNumber: checkIn.queueNumber,
    createdAt: checkIn.checkedInAt.toISOString(),
});

export const getCheckIn = async (req: Request, res: Response) => {
    try {
        const appointmentId = parseId(req.params.appointmentId);

        if (appointmentId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "appointmentId must be a valid numeric identifier",
                },
            });
        }

        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
        });

        if (!appointment) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Appointment not found",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canAccessAppointment(currentUser, appointment))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to view this appointment",
                },
            });
        }

        const checkIn = await prisma.checkIn.findUnique({
            where: { appointmentId },
        });

        if (!checkIn) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Check-in not found",
                },
            });
        }

        return res.status(200).json(serializeCheckIn(checkIn));
    } catch (error) {
        console.error("Get check-in failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve check-in",
            },
        });
    }
};

export const createCheckIn = async (req: Request, res: Response) => {
    const appointmentId = parseId(req.params.appointmentId);

    if (appointmentId === null) {
        return res.status(400).json({
            error: {
                code: "INVALID_REQUEST",
                message: "appointmentId must be a valid numeric identifier",
            },
        });
    }

    return performCheckIn(appointmentId, req, res);
};

// Flat alias for createCheckIn: appointmentId comes from the request body instead of the URL
export const createCheckInFlat = async (req: Request, res: Response) => {
    const appointmentId = parseId(req.body.appointmentId);

    if (appointmentId === null) {
        return res.status(400).json({
            error: {
                code: "INVALID_REQUEST",
                message: "appointmentId is required and must be a valid numeric identifier",
            },
        });
    }

    return performCheckIn(appointmentId, req, res);
};

const performCheckIn = async (appointmentId: bigint, req: Request, res: Response) => {
    try {
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
        });

        if (!appointment) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Appointment not found",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canAccessAppointment(currentUser, appointment))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to check in this appointment",
                },
            });
        }

        const { method } = req.body;

        if (!method) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "method is required",
                },
            });
        }

        // Queue number is the count of check-ins already made at this clinic for this date, plus one
        const queueNumber = (await prisma.checkIn.count({
            where: {
                appointment: {
                    clinicId: appointment.clinicId,
                    appointmentDate: appointment.appointmentDate,
                },
            },
        })) + 1;

        const checkIn = await prisma.checkIn.create({
            data: {
                appointmentId,
                checkedInByUserId: currentUser.id,
                method,
                queueNumber,
            },
        });

        return res.status(201).json(serializeCheckIn(checkIn));
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This appointment has already been checked in",
                },
            });
        }

        console.error("Create check-in failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to check in appointment",
            },
        });
    }
};

