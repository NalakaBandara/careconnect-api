import { logError } from "../utils/logError.js";
import { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { formatTime, parseTime } from "../utils/dayOfWeek.js";
import { fieldErrorResponse } from "../utils/errors.js";

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

const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const formatDateOnly = (value: Date): string => value.toISOString().substring(0, 10);

const BOOKING_REFERENCE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Human-friendly lookup code shown to patients, e.g. CC-4821-MEH - not a security token
const generateBookingReference = (): string => {
    const digits = crypto.randomInt(1000, 10000);
    const letters = Array.from({ length: 3 }, () =>
        BOOKING_REFERENCE_LETTERS[crypto.randomInt(BOOKING_REFERENCE_LETTERS.length)]
    ).join("");

    return `CC-${digits}-${letters}`;
};

const appointmentIncludes = {
    doctorProfile: { include: { user: true } },
    clinic: true,
    service: true,
};

const serializeAppointment = (appointment: any) => ({
    id: appointment.id.toString(),
    patientId: appointment.patientId.toString(),
    doctor: {
        id: appointment.doctorProfile.id.toString(),
        firstName: appointment.doctorProfile.user.firstName,
        lastName: appointment.doctorProfile.user.lastName,
        licenseNumber: appointment.doctorProfile.licenseNumber,
    },
    clinic: {
        id: appointment.clinic.id.toString(),
        name: appointment.clinic.name,
    },
    service: {
        id: appointment.service.id.toString(),
        name: appointment.service.name,
        durationMinutes: appointment.service.durationMinutes,
    },
    doctorScheduleId: appointment.doctorScheduleId.toString(),
    appointmentDate: formatDateOnly(appointment.appointmentDate),
    startTime: formatTime(appointment.startTime),
    endTime: formatTime(appointment.endTime),
    status: appointment.status,
    bookingReference: appointment.bookingReference,
    reason: appointment.reason,
    notes: appointment.notes,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
});

// ADMIN sees all; patient owner, assigned doctor, or CLINIC_ADMIN/STAFF of that clinic can access
export const canAccessAppointment = async (currentUser: any, appointment: any): Promise<boolean> => {
    const roleNames: string[] =
        currentUser?.userRoles?.map((userRole: any) => userRole.role.name) ?? [];

    if (roleNames.includes("ADMIN")) {
        return true;
    }

    if (appointment.patientId === currentUser.id) {
        return true;
    }

    if (currentUser?.doctorProfile?.id === appointment.doctorProfileId) {
        return true;
    }

    if (roleNames.includes("CLINIC_ADMIN") || roleNames.includes("STAFF")) {
        const clinicUser = await prisma.clinicUser.findUnique({
            where: {
                clinicId_userId: {
                    clinicId: appointment.clinicId,
                    userId: currentUser.id,
                },
            },
        });

        return !!clinicUser;
    }

    return false;
};

export const getMyAppointments = async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.user;
        const { status, fromDate, toDate } = req.query;

        const where: any = currentUser.doctorProfile
            ? { doctorProfileId: currentUser.doctorProfile.id }
            : { patientId: currentUser.id };

        if (status) {
            where.status = status as string;
        }

        if (fromDate || toDate) {
            where.appointmentDate = {};

            if (fromDate) {
                where.appointmentDate.gte = parseDateOnly(fromDate as string);
            }

            if (toDate) {
                where.appointmentDate.lte = parseDateOnly(toDate as string);
            }
        }

        const appointments = await prisma.appointment.findMany({
            where,
            include: appointmentIncludes,
            orderBy: { appointmentDate: "desc" },
        });

        return res.status(200).json({
            data: appointments.map(serializeAppointment),
        });
    } catch (error) {
        logError("List my appointments failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve appointments",
            },
        });
    }
};

export const getAppointmentById = async (req: Request, res: Response) => {
    try {
        const appointmentId = parseId(req.params.id);

        if (appointmentId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: appointmentIncludes,
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

        return res.status(200).json(serializeAppointment(appointment));
    } catch (error) {
        logError("Get appointment failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve appointment",
            },
        });
    }
};

export const createAppointment = async (req: Request, res: Response) => {
    try {
        const currentUser = res.locals.user;

        const {
            patientId,
            doctorProfileId,
            clinicId,
            serviceId,
            doctorScheduleId,
            appointmentDate,
            startTime,
            endTime,
            reason,
            notes,
        } = req.body;

        // Patients always book for themselves; ADMIN may book on behalf of another patient via patientId
        let effectivePatientId: bigint = currentUser.id;

        if (patientId !== undefined) {
            const parsedPatientId = parseId(patientId);

            if (parsedPatientId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "patientId must be a valid numeric identifier",
                    },
                });
            }

            const roleNames: string[] =
                currentUser?.userRoles?.map((userRole: any) => userRole.role.name) ?? [];

            if (parsedPatientId !== currentUser.id && !roleNames.includes("ADMIN")) {
                return res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message: "You can only create appointments for yourself",
                    },
                });
            }

            effectivePatientId = parsedPatientId;
        }

        const parsedDoctorProfileId = parseId(doctorProfileId);
        const parsedClinicId = parseId(clinicId);
        const parsedServiceId = parseId(serviceId);
        const parsedDoctorScheduleId = parseId(doctorScheduleId);

        if (
            parsedDoctorProfileId === null ||
            parsedClinicId === null ||
            parsedServiceId === null ||
            parsedDoctorScheduleId === null ||
            !appointmentDate ||
            !startTime ||
            !endTime
        ) {
            return res.status(400).json(
                fieldErrorResponse(
                    {
                        ...(parsedDoctorProfileId === null && { doctorProfileId: ["doctorProfileId is required"] }),
                        ...(parsedClinicId === null && { clinicId: ["clinicId is required"] }),
                        ...(parsedServiceId === null && { serviceId: ["serviceId is required"] }),
                        ...(parsedDoctorScheduleId === null && { doctorScheduleId: ["doctorScheduleId is required"] }),
                        ...(!appointmentDate && { appointmentDate: ["appointmentDate is required"] }),
                        ...(!startTime && { startTime: ["startTime is required"] }),
                        ...(!endTime && { endTime: ["endTime is required"] }),
                    },
                    "doctorProfileId, clinicId, serviceId, doctorScheduleId, appointmentDate, startTime and endTime are required"
                )
            );
        }

        const [doctorProfile, clinic, service, doctorSchedule, patient] = await Promise.all([
            prisma.doctorProfile.findUnique({ where: { id: parsedDoctorProfileId } }),
            prisma.clinic.findUnique({ where: { id: parsedClinicId } }),
            prisma.service.findUnique({ where: { id: parsedServiceId } }),
            prisma.doctorSchedule.findUnique({ where: { id: parsedDoctorScheduleId } }),
            effectivePatientId === currentUser.id
                ? Promise.resolve(currentUser)
                : prisma.user.findUnique({ where: { id: effectivePatientId } }),
        ]);

        if (!doctorProfile || !clinic || !service || !doctorSchedule || !patient) {
            const missing = [
                !doctorProfile && "doctorProfileId",
                !clinic && "clinicId",
                !service && "serviceId",
                !doctorSchedule && "doctorScheduleId",
                !patient && "patientId",
            ].filter(Boolean);

            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: `No record found for: ${missing.join(", ")}`,
                },
            });
        }

        if (
            doctorSchedule.doctorProfileId !== parsedDoctorProfileId ||
            doctorSchedule.clinicId !== parsedClinicId
        ) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "doctorScheduleId does not belong to this doctor and clinic",
                },
            });
        }

        const parsedAppointmentDate = parseDateOnly(appointmentDate);

        const conflict = await prisma.appointment.findFirst({
            where: {
                doctorProfileId: parsedDoctorProfileId,
                clinicId: parsedClinicId,
                appointmentDate: parsedAppointmentDate,
                startTime: parseTime(startTime),
                status: { not: "CANCELLED" },
            },
        });

        if (conflict) {
            return res
                .status(409)
                .json(
                    fieldErrorResponse(
                        { startTime: ["This time slot is no longer available"] },
                        "This time slot is no longer available",
                        "CONFLICT"
                    )
                );
        }

        let appointment;
        let bookingReferenceAttempts = 0;

        while (true) {
            try {
                appointment = await prisma.appointment.create({
                    data: {
                        patientId: effectivePatientId,
                        doctorProfileId: parsedDoctorProfileId,
                        clinicId: parsedClinicId,
                        serviceId: parsedServiceId,
                        doctorScheduleId: parsedDoctorScheduleId,
                        appointmentDate: parsedAppointmentDate,
                        startTime: parseTime(startTime),
                        endTime: parseTime(endTime),
                        status: "PENDING",
                        reason: reason || null,
                        notes: notes || null,
                        bookingReference: generateBookingReference(),
                        statusHistory: {
                            create: {
                                status: "PENDING",
                                reason: "Appointment created",
                                changedByUserId: currentUser.id,
                            },
                        },
                    },
                    include: appointmentIncludes,
                });

                break;
            } catch (error: any) {
                // Extremely unlikely random-reference collision - regenerate and retry a few times
                if (
                    error?.code === "P2002" &&
                    error?.meta?.target?.includes("bookingReference") &&
                    bookingReferenceAttempts < 5
                ) {
                    bookingReferenceAttempts += 1;

                    continue;
                }

                throw error;
            }
        }

        return res.status(201).json(serializeAppointment(appointment));
    } catch (error) {
        logError("Create appointment failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create appointment",
            },
        });
    }
};

// PATCH /:id (+ alias /:id/status) - also handles rescheduling when doctor/clinic/service/schedule/date/time fields are present
export const updateAppointment = async (req: Request, res: Response) => {
    try {
        const appointmentId = parseId(req.params.id);

        if (appointmentId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const existingAppointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
        });

        if (!existingAppointment) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Appointment not found",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canAccessAppointment(currentUser, existingAppointment))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to update this appointment",
                },
            });
        }

        const {
            status,
            reason,
            notes,
            doctorProfileId,
            clinicId,
            serviceId,
            doctorScheduleId,
            appointmentDate,
            startTime,
            endTime,
        } = req.body;

        const isReschedule =
            doctorProfileId !== undefined ||
            clinicId !== undefined ||
            serviceId !== undefined ||
            doctorScheduleId !== undefined ||
            appointmentDate !== undefined ||
            startTime !== undefined ||
            endTime !== undefined;

        const updateData: any = {
            status: status || undefined,
            reason: reason ?? undefined,
            notes: notes ?? undefined,
        };

        let statusHistoryCreate: any;

        if (isReschedule) {
            const parsedDoctorProfileId =
                doctorProfileId !== undefined ? parseId(doctorProfileId) : existingAppointment.doctorProfileId;
            const parsedClinicId = clinicId !== undefined ? parseId(clinicId) : existingAppointment.clinicId;
            const parsedServiceId = serviceId !== undefined ? parseId(serviceId) : existingAppointment.serviceId;
            const parsedDoctorScheduleId =
                doctorScheduleId !== undefined ? parseId(doctorScheduleId) : existingAppointment.doctorScheduleId;

            if (
                parsedDoctorProfileId === null ||
                parsedClinicId === null ||
                parsedServiceId === null ||
                parsedDoctorScheduleId === null
            ) {
                return res.status(400).json(
                    fieldErrorResponse(
                        {
                            ...(parsedDoctorProfileId === null && {
                                doctorProfileId: ["doctorProfileId must be a valid numeric identifier"],
                            }),
                            ...(parsedClinicId === null && {
                                clinicId: ["clinicId must be a valid numeric identifier"],
                            }),
                            ...(parsedServiceId === null && {
                                serviceId: ["serviceId must be a valid numeric identifier"],
                            }),
                            ...(parsedDoctorScheduleId === null && {
                                doctorScheduleId: ["doctorScheduleId must be a valid numeric identifier"],
                            }),
                        },
                        "doctorProfileId, clinicId, serviceId and doctorScheduleId must be valid numeric identifiers"
                    )
                );
            }

            const parsedAppointmentDate = appointmentDate
                ? parseDateOnly(appointmentDate)
                : existingAppointment.appointmentDate;
            const parsedStartTime = startTime ? parseTime(startTime) : existingAppointment.startTime;
            const parsedEndTime = endTime ? parseTime(endTime) : existingAppointment.endTime;

            const [doctorProfile, clinic, service, doctorSchedule] = await Promise.all([
                prisma.doctorProfile.findUnique({ where: { id: parsedDoctorProfileId } }),
                prisma.clinic.findUnique({ where: { id: parsedClinicId } }),
                prisma.service.findUnique({ where: { id: parsedServiceId } }),
                prisma.doctorSchedule.findUnique({ where: { id: parsedDoctorScheduleId } }),
            ]);

            if (!doctorProfile || !clinic || !service || !doctorSchedule) {
                const missing = [
                    !doctorProfile && "doctorProfileId",
                    !clinic && "clinicId",
                    !service && "serviceId",
                    !doctorSchedule && "doctorScheduleId",
                ].filter(Boolean);

                return res.status(404).json({
                    error: {
                        code: "NOT_FOUND",
                        message: `No record found for: ${missing.join(", ")}`,
                    },
                });
            }

            if (
                doctorSchedule.doctorProfileId !== parsedDoctorProfileId ||
                doctorSchedule.clinicId !== parsedClinicId
            ) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "doctorScheduleId does not belong to this doctor and clinic",
                    },
                });
            }

            const conflict = await prisma.appointment.findFirst({
                where: {
                    id: { not: appointmentId },
                    doctorProfileId: parsedDoctorProfileId,
                    clinicId: parsedClinicId,
                    appointmentDate: parsedAppointmentDate,
                    startTime: parsedStartTime,
                    status: { not: "CANCELLED" },
                },
            });

            if (conflict) {
                return res
                    .status(409)
                    .json(
                        fieldErrorResponse(
                            { startTime: ["This time slot is no longer available"] },
                            "This time slot is no longer available",
                            "CONFLICT"
                        )
                    );
            }

            updateData.doctorProfileId = parsedDoctorProfileId;
            updateData.clinicId = parsedClinicId;
            updateData.serviceId = parsedServiceId;
            updateData.doctorScheduleId = parsedDoctorScheduleId;
            updateData.appointmentDate = parsedAppointmentDate;
            updateData.startTime = parsedStartTime;
            updateData.endTime = parsedEndTime;

            statusHistoryCreate = {
                status: status || existingAppointment.status,
                reason: reason || "Appointment rescheduled",
                changedByUserId: currentUser.id,
            };
        } else if (status) {
            statusHistoryCreate = {
                status,
                reason: reason || null,
                changedByUserId: currentUser.id,
            };
        }

        const appointment = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                ...updateData,
                statusHistory: statusHistoryCreate ? { create: statusHistoryCreate } : undefined,
            },
            include: appointmentIncludes,
        });

        return res.status(200).json(serializeAppointment(appointment));
    } catch (error) {
        logError("Update appointment failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update appointment",
            },
        });
    }
};

export const getAppointmentStatusHistory = async (req: Request, res: Response) => {
    try {
        const appointmentId = parseId(req.params.id);

        if (appointmentId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
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

        const history = await prisma.appointmentStatusHistory.findMany({
            where: { appointmentId },
            orderBy: { createdAt: "asc" },
        });

        return res.status(200).json({
            data: history.map((entry) => ({
                id: entry.id.toString(),
                appointmentId: entry.appointmentId.toString(),
                status: entry.status,
                changedByUserId: entry.changedByUserId.toString(),
                reason: entry.reason,
                createdAt: entry.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        logError("Get appointment status history failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve appointment status history",
            },
        });
    }
};

// ADMIN-only cross-user listing with optional filters, distinct from GET /me (which is scoped to the caller)
export const getAppointments = async (req: Request, res: Response) => {
    try {
        const { patientId, doctorId, clinicId, status, fromDate, toDate } = req.query;

        const where: any = {};

        if (patientId) {
            const parsedPatientId = parseId(patientId as string | string[] | undefined);

            if (parsedPatientId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "patientId must be a valid numeric identifier",
                    },
                });
            }

            where.patientId = parsedPatientId;
        }

        if (doctorId) {
            const parsedDoctorId = parseId(doctorId as string | string[] | undefined);

            if (parsedDoctorId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "doctorId must be a valid numeric identifier",
                    },
                });
            }

            where.doctorProfileId = parsedDoctorId;
        }

        if (clinicId) {
            const parsedClinicId = parseId(clinicId as string | string[] | undefined);

            if (parsedClinicId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "clinicId must be a valid numeric identifier",
                    },
                });
            }

            where.clinicId = parsedClinicId;
        }

        if (typeof status === "string") {
            where.status = status;
        }

        if (fromDate || toDate) {
            where.appointmentDate = {};

            if (fromDate) {
                where.appointmentDate.gte = parseDateOnly(fromDate as string);
            }

            if (toDate) {
                where.appointmentDate.lte = parseDateOnly(toDate as string);
            }
        }

        const appointments = await prisma.appointment.findMany({
            where,
            include: appointmentIncludes,
            orderBy: { appointmentDate: "desc" },
        });

        return res.status(200).json({
            data: appointments.map(serializeAppointment),
        });
    } catch (error) {
        logError("List appointments failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve appointments",
            },
        });
    }
};

export const cancelAppointment = async (req: Request, res: Response) => {
    try {
        const appointmentId = parseId(req.params.id);

        if (appointmentId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const existingAppointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
        });

        if (!existingAppointment) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Appointment not found",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canAccessAppointment(currentUser, existingAppointment))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to cancel this appointment",
                },
            });
        }

        const appointment = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: "CANCELLED",
                statusHistory: {
                    create: {
                        status: "CANCELLED",
                        reason: "Cancelled by user",
                        changedByUserId: currentUser.id,
                    },
                },
            },
            include: appointmentIncludes,
        });

        return res.status(200).json(serializeAppointment(appointment));
    } catch (error) {
        logError("Cancel appointment failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to cancel appointment",
            },
        });
    }
};
