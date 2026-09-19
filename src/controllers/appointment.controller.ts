import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { formatTime, parseTime } from "../utils/dayOfWeek.js";

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
        console.error("List my appointments failed:", error);

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
        console.error("Get appointment failed:", error);

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
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message:
                        "doctorProfileId, clinicId, serviceId, doctorScheduleId, appointmentDate, startTime and endTime are required",
                },
            });
        }

        const [doctorProfile, clinic, service, doctorSchedule] = await Promise.all([
            prisma.doctorProfile.findUnique({ where: { id: parsedDoctorProfileId } }),
            prisma.clinic.findUnique({ where: { id: parsedClinicId } }),
            prisma.service.findUnique({ where: { id: parsedServiceId } }),
            prisma.doctorSchedule.findUnique({ where: { id: parsedDoctorScheduleId } }),
        ]);

        if (!doctorProfile || !clinic || !service || !doctorSchedule) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Doctor, clinic, service or schedule not found",
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
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This time slot is no longer available",
                },
            });
        }

        const appointment = await prisma.appointment.create({
            data: {
                patientId: currentUser.id,
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

        return res.status(201).json(serializeAppointment(appointment));
    } catch (error) {
        console.error("Create appointment failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create appointment",
            },
        });
    }
};

export const updateAppointmentStatus = async (req: Request, res: Response) => {
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

        const { status, reason, notes } = req.body;

        const appointment = await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: status || undefined,
                reason: reason ?? undefined,
                notes: notes ?? undefined,
                statusHistory: status
                    ? {
                          create: {
                              status,
                              reason: reason || null,
                              changedByUserId: currentUser.id,
                          },
                      }
                    : undefined,
            },
            include: appointmentIncludes,
        });

        return res.status(200).json(serializeAppointment(appointment));
    } catch (error) {
        console.error("Update appointment failed:", error);

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
        console.error("Get appointment status history failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve appointment status history",
            },
        });
    }
};
