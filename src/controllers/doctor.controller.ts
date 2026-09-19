import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { DAYS_OF_WEEK, dayOfWeekToInt, formatTime, parseTime } from "../utils/dayOfWeek.js";

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

const canManageDoctor = (currentUser: any, doctorProfileId: bigint): boolean => {
    const roleNames: string[] =
        currentUser?.userRoles?.map((userRole: any) => userRole.role.name) ?? [];

    if (roleNames.includes("ADMIN")) {
        return true;
    }

    return currentUser?.doctorProfile?.id === doctorProfileId;
};

// Full detail shape used by GET (list) and GET (by id)
const serializeDoctorDetail = (doctorProfile: any) => ({
    id: doctorProfile.id.toString(),
    userId: doctorProfile.userId.toString(),
    firstName: doctorProfile.user.firstName,
    lastName: doctorProfile.user.lastName,
    profilePhoto: doctorProfile.user.profilePhoto,
    licenseNumber: doctorProfile.licenseNumber,
    bio: doctorProfile.bio,
    yearsOfExperience: doctorProfile.yearsOfExperience,
    isVerified: doctorProfile.isVerified,
    specialties: doctorProfile.doctorSpecialties.map((doctorSpecialty: any) => ({
        id: doctorSpecialty.specialty.id.toString(),
        name: doctorSpecialty.specialty.name,
        description: doctorSpecialty.specialty.description,
    })),
    clinics: doctorProfile.doctorClinics.map((doctorClinic: any) => ({
        id: doctorClinic.clinic.id.toString(),
        name: doctorClinic.clinic.name,
    })),
});

// Slimmer shape used by POST response (matches contract - specialties without description)
const serializeDoctorCreated = (doctorProfile: any) => ({
    id: doctorProfile.id.toString(),
    userId: doctorProfile.userId.toString(),
    licenseNumber: doctorProfile.licenseNumber,
    bio: doctorProfile.bio,
    yearsOfExperience: doctorProfile.yearsOfExperience,
    isVerified: doctorProfile.isVerified,
    specialties: doctorProfile.doctorSpecialties.map((doctorSpecialty: any) => ({
        id: doctorSpecialty.specialty.id.toString(),
        name: doctorSpecialty.specialty.name,
    })),
    clinics: doctorProfile.doctorClinics.map((doctorClinic: any) => ({
        id: doctorClinic.clinic.id.toString(),
        name: doctorClinic.clinic.name,
    })),
});

const doctorDetailIncludes = {
    user: true,
    doctorSpecialties: { include: { specialty: true } },
    doctorClinics: { include: { clinic: true } },
};

export const getDoctors = async (req: Request, res: Response) => {
    try {
        const { clinicId, specialtyId } = req.query;

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

            where.doctorClinics = { some: { clinicId: parsedClinicId } };
        }

        if (specialtyId) {
            const parsedSpecialtyId = parseId(specialtyId as string);

            if (parsedSpecialtyId === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: "specialtyId must be a valid numeric identifier",
                    },
                });
            }

            where.doctorSpecialties = { some: { specialtyId: parsedSpecialtyId } };
        }

        const doctors = await prisma.doctorProfile.findMany({
            where,
            include: doctorDetailIncludes,
            orderBy: { id: "asc" },
        });

        return res.status(200).json({
            data: doctors.map(serializeDoctorDetail),
        });
    } catch (error) {
        console.error("List doctors failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve doctors",
            },
        });
    }
};

export const getDoctorById = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.id);

        if (doctorProfileId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const doctor = await prisma.doctorProfile.findUnique({
            where: { id: doctorProfileId },
            include: doctorDetailIncludes,
        });

        if (!doctor) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Doctor not found",
                },
            });
        }

        return res.status(200).json(serializeDoctorDetail(doctor));
    } catch (error) {
        console.error("Get doctor failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve doctor",
            },
        });
    }
};

export const createDoctor = async (req: Request, res: Response) => {
    try {
        const {
            userId,
            licenseNumber,
            bio,
            yearsOfExperience,
            isVerified,
            specialtyIds,
            clinicIds,
        } = req.body;

        if (!userId) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "userId is required",
                },
            });
        }

        const parsedUserId = parseId(userId);

        if (parsedUserId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "userId must be a valid numeric identifier",
                },
            });
        }

        const user = await prisma.user.findUnique({ where: { id: parsedUserId } });

        if (!user) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "User not found",
                },
            });
        }

        const existingProfile = await prisma.doctorProfile.findUnique({
            where: { userId: parsedUserId },
        });

        if (existingProfile) {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This user already has a doctor profile",
                },
            });
        }

        const doctorRole = await prisma.role.findUnique({ where: { name: "DOCTOR" } });

        if (!doctorRole) {
            return res.status(500).json({
                error: {
                    code: "ROLE_NOT_FOUND",
                    message: "DOCTOR role not configured",
                },
            });
        }

        const doctor = await prisma.doctorProfile.create({
            data: {
                userId: parsedUserId,
                licenseNumber: licenseNumber || null,
                bio: bio || null,
                yearsOfExperience: yearsOfExperience ?? null,
                isVerified: !!isVerified,
                doctorSpecialties: {
                    create: (specialtyIds || []).map((specialtyId: string) => ({
                        specialtyId: BigInt(specialtyId),
                    })),
                },
                doctorClinics: {
                    create: (clinicIds || []).map((clinicId: string) => ({
                        clinicId: BigInt(clinicId),
                    })),
                },
            },
            include: doctorDetailIncludes,
        });

        await prisma.userRole.upsert({
            where: {
                userId_roleId: { userId: parsedUserId, roleId: doctorRole.id },
            },
            update: {},
            create: { userId: parsedUserId, roleId: doctorRole.id },
        });

        return res.status(201).json(serializeDoctorCreated(doctor));
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "licenseNumber is already registered to another doctor",
                },
            });
        }

        console.error("Create doctor failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create doctor",
            },
        });
    }
};

export const updateDoctor = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.id);

        if (doctorProfileId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const { bio, yearsOfExperience, isVerified } = req.body;

        const doctor = await prisma.doctorProfile.update({
            where: { id: doctorProfileId },
            data: {
                bio: bio ?? undefined,
                yearsOfExperience: yearsOfExperience ?? undefined,
                isVerified: isVerified ?? undefined,
            },
        });

        return res.status(200).json({
            id: doctor.id.toString(),
            userId: doctor.userId.toString(),
            licenseNumber: doctor.licenseNumber,
            bio: doctor.bio,
            yearsOfExperience: doctor.yearsOfExperience,
            isVerified: doctor.isVerified,
        });
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Doctor not found",
                },
            });
        }

        console.error("Update doctor failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update doctor",
            },
        });
    }
};

export const getDoctorSchedules = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.id);

        if (doctorProfileId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const { clinicId } = req.query;

        const where: any = { doctorProfileId };

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

            where.clinicId = parsedClinicId;
        }

        const schedules = await prisma.doctorSchedule.findMany({
            where,
            orderBy: { dayOfWeek: "asc" },
        });

        return res.status(200).json({
            data: schedules.map((schedule) => ({
                id: schedule.id.toString(),
                clinicId: schedule.clinicId.toString(),
                dayOfWeek: DAYS_OF_WEEK[schedule.dayOfWeek],
                startTime: formatTime(schedule.startTime),
                endTime: formatTime(schedule.endTime),
                slotDurationMinutes: schedule.slotDurationMinutes,
                isActive: schedule.isActive,
            })),
        });
    } catch (error) {
        console.error("Get doctor schedules failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve doctor schedules",
            },
        });
    }
};

export const createDoctorSchedule = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.id);

        if (doctorProfileId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!canManageDoctor(currentUser, doctorProfileId)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this doctor's schedule",
                },
            });
        }

        const { clinicId, dayOfWeek, startTime, endTime, slotDurationMinutes, isActive } = req.body;

        const parsedClinicId = parseId(clinicId);
        const parsedDayOfWeek = dayOfWeekToInt(dayOfWeek);

        if (parsedClinicId === null || parsedDayOfWeek === null || !startTime || !endTime || !slotDurationMinutes) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "clinicId, dayOfWeek, startTime, endTime and slotDurationMinutes are required",
                },
            });
        }

        const schedule = await prisma.doctorSchedule.create({
            data: {
                doctorProfileId,
                clinicId: parsedClinicId,
                dayOfWeek: parsedDayOfWeek,
                startTime: parseTime(startTime),
                endTime: parseTime(endTime),
                slotDurationMinutes,
                isActive: isActive ?? true,
            },
        });

        return res.status(201).json({
            id: schedule.id.toString(),
            doctorProfileId: schedule.doctorProfileId.toString(),
            clinicId: schedule.clinicId.toString(),
            dayOfWeek: DAYS_OF_WEEK[schedule.dayOfWeek],
            startTime: formatTime(schedule.startTime),
            endTime: formatTime(schedule.endTime),
            slotDurationMinutes: schedule.slotDurationMinutes,
            isActive: schedule.isActive,
        });
    } catch (error) {
        console.error("Create doctor schedule failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create doctor schedule",
            },
        });
    }
};

export const updateDoctorSchedule = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.id);
        const scheduleId = parseId(req.params.scheduleId);

        if (doctorProfileId === null || scheduleId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id and scheduleId must be valid numeric identifiers",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!canManageDoctor(currentUser, doctorProfileId)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this doctor's schedule",
                },
            });
        }

        const existingSchedule = await prisma.doctorSchedule.findUnique({
            where: { id: scheduleId },
        });

        if (!existingSchedule || existingSchedule.doctorProfileId !== doctorProfileId) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Schedule not found for this doctor",
                },
            });
        }

        const { clinicId, dayOfWeek, startTime, endTime, slotDurationMinutes, isActive } = req.body;

        const parsedClinicId = parseId(clinicId);
        const parsedDayOfWeek = dayOfWeekToInt(dayOfWeek);

        if (parsedClinicId === null || parsedDayOfWeek === null || !startTime || !endTime || !slotDurationMinutes) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "clinicId, dayOfWeek, startTime, endTime and slotDurationMinutes are required",
                },
            });
        }

        const schedule = await prisma.doctorSchedule.update({
            where: { id: scheduleId },
            data: {
                clinicId: parsedClinicId,
                dayOfWeek: parsedDayOfWeek,
                startTime: parseTime(startTime),
                endTime: parseTime(endTime),
                slotDurationMinutes,
                isActive: isActive ?? true,
            },
        });

        return res.status(200).json({
            id: schedule.id.toString(),
            doctorProfileId: schedule.doctorProfileId.toString(),
            clinicId: schedule.clinicId.toString(),
            dayOfWeek: DAYS_OF_WEEK[schedule.dayOfWeek],
            startTime: formatTime(schedule.startTime),
            endTime: formatTime(schedule.endTime),
            slotDurationMinutes: schedule.slotDurationMinutes,
            isActive: schedule.isActive,
        });
    } catch (error) {
        console.error("Update doctor schedule failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update doctor schedule",
            },
        });
    }
};

export const getDoctorAvailableSlots = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.id);
        const { clinicId, date, serviceId } = req.query;

        if (doctorProfileId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const parsedClinicId = parseId(clinicId as string);

        if (parsedClinicId === null || !date) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "clinicId and date are required",
                },
            });
        }

        const targetDate = new Date(`${date}T00:00:00.000Z`);

        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "date must be a valid date (YYYY-MM-DD)",
                },
            });
        }

        const dayOfWeek = targetDate.getUTCDay();

        const schedule = await prisma.doctorSchedule.findFirst({
            where: {
                doctorProfileId,
                clinicId: parsedClinicId,
                dayOfWeek,
                isActive: true,
            },
        });

        if (!schedule) {
            return res.status(200).json({
                doctorId: doctorProfileId.toString(),
                clinicId: parsedClinicId.toString(),
                serviceId: serviceId ? (serviceId as string) : null,
                date,
                slots: [],
            });
        }

        const existingAppointments = await prisma.appointment.findMany({
            where: {
                doctorProfileId,
                clinicId: parsedClinicId,
                appointmentDate: targetDate,
                status: { not: "CANCELLED" },
            },
        });

        const bookedStartTimes = new Set(
            existingAppointments.map((appointment) => formatTime(appointment.startTime))
        );

        const slots: { startTime: string; endTime: string; available: boolean }[] = [];

        let cursor = schedule.startTime.getTime();
        const scheduleEnd = schedule.endTime.getTime();
        const stepMs = schedule.slotDurationMinutes * 60 * 1000;

        while (cursor + stepMs <= scheduleEnd) {
            const slotStart = new Date(cursor);
            const slotEnd = new Date(cursor + stepMs);
            const slotStartStr = formatTime(slotStart) as string;

            slots.push({
                startTime: slotStartStr,
                endTime: formatTime(slotEnd) as string,
                available: !bookedStartTimes.has(slotStartStr),
            });

            cursor += stepMs;
        }

        return res.status(200).json({
            doctorId: doctorProfileId.toString(),
            clinicId: parsedClinicId.toString(),
            serviceId: serviceId ? (serviceId as string) : null,
            date,
            slots,
        });
    } catch (error) {
        console.error("Get doctor available slots failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve available slots",
            },
        });
    }
};

export const addDoctorSpecialty = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.doctorId);

        if (doctorProfileId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "doctorId must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!canManageDoctor(currentUser, doctorProfileId)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this doctor",
                },
            });
        }

        const specialtyId = parseId(req.body.specialtyId);

        if (specialtyId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "specialtyId is required and must be a valid numeric identifier",
                },
            });
        }

        const [doctor, specialty] = await Promise.all([
            prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } }),
            prisma.specialty.findUnique({ where: { id: specialtyId } }),
        ]);

        if (!doctor || !specialty) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Doctor or specialty not found",
                },
            });
        }

        await prisma.doctorSpecialty.create({
            data: {
                doctorProfileId,
                specialtyId,
            },
        });

        return res.status(201).json({
            doctorId: doctorProfileId.toString(),
            specialtyId: specialtyId.toString(),
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This specialty is already linked to this doctor",
                },
            });
        }

        console.error("Add doctor specialty failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to add specialty to doctor",
            },
        });
    }
};

export const removeDoctorSpecialty = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.doctorId);
        const specialtyId = parseId(req.params.specialtyId);

        if (doctorProfileId === null || specialtyId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "doctorId and specialtyId must be valid numeric identifiers",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!canManageDoctor(currentUser, doctorProfileId)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this doctor",
                },
            });
        }

        await prisma.doctorSpecialty.delete({
            where: {
                doctorProfileId_specialtyId: {
                    doctorProfileId,
                    specialtyId,
                },
            },
        });

        return res.status(200).json({
            doctorId: doctorProfileId.toString(),
            specialtyId: specialtyId.toString(),
            removed: true,
        });
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "This specialty is not linked to this doctor",
                },
            });
        }

        console.error("Remove doctor specialty failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to remove specialty from doctor",
            },
        });
    }
};

export const addDoctorClinic = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.doctorId);

        if (doctorProfileId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "doctorId must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!canManageDoctor(currentUser, doctorProfileId)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this doctor",
                },
            });
        }

        const clinicId = parseId(req.body.clinicId);

        if (clinicId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "clinicId is required and must be a valid numeric identifier",
                },
            });
        }

        const [doctor, clinic] = await Promise.all([
            prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } }),
            prisma.clinic.findUnique({ where: { id: clinicId } }),
        ]);

        if (!doctor || !clinic) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Doctor or clinic not found",
                },
            });
        }

        await prisma.doctorClinic.create({
            data: {
                doctorProfileId,
                clinicId,
            },
        });

        return res.status(201).json({
            doctorId: doctorProfileId.toString(),
            clinicId: clinicId.toString(),
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This clinic is already linked to this doctor",
                },
            });
        }

        console.error("Add doctor clinic failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to add clinic to doctor",
            },
        });
    }
};

export const removeDoctorClinic = async (req: Request, res: Response) => {
    try {
        const doctorProfileId = parseId(req.params.doctorId);
        const clinicId = parseId(req.params.clinicId);

        if (doctorProfileId === null || clinicId === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "doctorId and clinicId must be valid numeric identifiers",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!canManageDoctor(currentUser, doctorProfileId)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this doctor",
                },
            });
        }

        await prisma.doctorClinic.delete({
            where: {
                doctorProfileId_clinicId: {
                    doctorProfileId,
                    clinicId,
                },
            },
        });

        return res.status(200).json({
            doctorId: doctorProfileId.toString(),
            clinicId: clinicId.toString(),
            removed: true,
        });
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "This clinic is not linked to this doctor",
                },
            });
        }

        console.error("Remove doctor clinic failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to remove clinic from doctor",
            },
        });
    }
};


