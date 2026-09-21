import { logError } from "../utils/logError.js";
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { DAYS_OF_WEEK, dayOfWeekToInt, formatTime, parseTime } from "../utils/dayOfWeek.js";

const canManageClinic = async (currentUser: any, clinicId: bigint) => {
    const roleNames: string[] =
        currentUser?.userRoles?.map((userRole: any) => userRole.role.name) ?? [];

    if (roleNames.includes("ADMIN")) {
        return true;
    }

    const clinicUser = await prisma.clinicUser.findUnique({
        where: {
            clinicId_userId: {
                clinicId,
                userId: currentUser.id,
            },
        },
    });

    return !!clinicUser;
};

const serializeClinic = (clinic: any) => ({
    id: clinic.id.toString(),
    name: clinic.name,
    description: clinic.description,
    addressLine1: clinic.addressLine1,
    addressLine2: clinic.addressLine2,
    city: clinic.city,
    district: clinic.district,
    province: clinic.province,
    postalCode: clinic.postalCode,
    country: clinic.country,
    telephone: clinic.telephone,
    email: clinic.email,
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    status: clinic.status,
});

export const getClinics = async (req: Request, res: Response) => {
    try {
        const { city, status } = req.query;

        const where: any = {};

        if (typeof city === "string") {
            where.city = { equals: city, mode: "insensitive" };
        }

        if (typeof status === "string") {
            where.status = status;
        }

        const clinics = await prisma.clinic.findMany({
            where,
            orderBy: {
                id: "asc",
            },
        });

        return res.status(200).json({
            data: clinics.map(serializeClinic),
        });
    } catch (error) {
        logError("List clinics failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve clinics",
            },
        });
    }
};

export const getClinicById = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const clinic = await prisma.clinic.findUnique({
            where: {
                id: clinicId,
            },
        });

        if (!clinic) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Clinic not found",
                },
            });
        }

        return res.status(200).json(serializeClinic(clinic));
    } catch (error) {
        logError("Get clinic failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve clinic",
            },
        });
    }
};

export const createClinic = async (req: Request, res: Response) => {
    try {
        const {
            name,
            description,
            addressLine1,
            addressLine2,
            city,
            district,
            province,
            postalCode,
            country,
            telephone,
            email,
            latitude,
            longitude,
            status,
        } = req.body;

        if (!name || !addressLine1 || !city) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "name, addressLine1 and city are required",
                },
            });
        }

        const clinic = await prisma.clinic.create({
            data: {
                name,
                description: description || null,
                addressLine1,
                addressLine2: addressLine2 || null,
                city,
                district: district || null,
                province: province || null,
                postalCode: postalCode || null,
                country: country || "Sri Lanka",
                telephone: telephone || null,
                email: email || null,
                latitude: latitude || null,
                longitude: longitude || null,
                status: status || "ACTIVE",
            },
        });

        return res.status(201).json(serializeClinic(clinic));
    } catch (error) {
        logError("Create clinic failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create clinic",
            },
        });
    }
};

export const updateClinic = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        // CLINIC_ADMIN can only manage clinics they're linked to, ADMIN can manage any
        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        const {
            name,
            description,
            addressLine1,
            addressLine2,
            city,
            district,
            province,
            postalCode,
            country,
            telephone,
            email,
            latitude,
            longitude,
            status,
        } = req.body;

        if (!name || !addressLine1 || !city) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "name, addressLine1 and city are required",
                },
            });
        }

        const clinic = await prisma.clinic.update({
            where: {
                id: clinicId,
            },
            data: {
                name,
                description: description || null,
                addressLine1,
                addressLine2: addressLine2 || null,
                city,
                district: district || null,
                province: province || null,
                postalCode: postalCode || null,
                country: country || "Sri Lanka",
                telephone: telephone || null,
                email: email || null,
                latitude: latitude || null,
                longitude: longitude || null,
                status: status || "ACTIVE",
            },
        });

        return res.status(200).json(serializeClinic(clinic));
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Clinic not found",
                },
            });
        }

        logError("Update clinic failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update clinic",
            },
        });
    }
};

export const deleteClinic = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        await prisma.clinic.delete({ where: { id: clinicId } });

        return res.status(204).send();
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Clinic not found",
                },
            });
        }

        logError("Delete clinic failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to delete clinic",
            },
        });
    }
};

export const getClinicOperatingHours = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const hours = await prisma.clinicOperatingHour.findMany({
            where: {
                clinicId,
            },
            orderBy: {
                dayOfWeek: "asc",
            },
        });

        return res.status(200).json({
            data: hours.map((hour) => ({
                id: hour.id.toString(),
                dayOfWeek: DAYS_OF_WEEK[hour.dayOfWeek],
                openingTime: formatTime(hour.openingTime),
                closingTime: formatTime(hour.closingTime),
                isClosed: hour.isClosed,
            })),
        });
    } catch (error) {
        logError("Get clinic operating hours failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve operating hours",
            },
        });
    }
};

export const createClinicOperatingHour = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        const { dayOfWeek: dayOfWeekInput, openingTime, closingTime, isClosed } = req.body;

        const dayOfWeek = dayOfWeekToInt(dayOfWeekInput);

        if (dayOfWeek === null) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: `Invalid dayOfWeek: ${dayOfWeekInput}`,
                },
            });
        }

        if (!isClosed && (!openingTime || !closingTime)) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "openingTime and closingTime are required when isClosed is false",
                },
            });
        }

        const hour = await prisma.clinicOperatingHour.create({
            data: {
                clinicId,
                dayOfWeek,
                openingTime: isClosed ? null : parseTime(openingTime),
                closingTime: isClosed ? null : parseTime(closingTime),
                isClosed: !!isClosed,
            },
        });

        return res.status(201).json({
            data: {
                id: hour.id.toString(),
                dayOfWeek: DAYS_OF_WEEK[hour.dayOfWeek],
                openingTime: formatTime(hour.openingTime),
                closingTime: formatTime(hour.closingTime),
                isClosed: hour.isClosed,
            },
        });
    } catch (error: any) {
        // Unique constraint on (clinicId, dayOfWeek) means that day already has hours
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "Operating hours for this day already exist; use PUT to update",
                },
            });
        }

        if (error?.code === "P2003") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Clinic not found",
                },
            });
        }

        logError("Create clinic operating hour failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create operating hour",
            },
        });
    }
};

export const updateClinicOperatingHours = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        const { hours } = req.body;

        if (!Array.isArray(hours) || hours.length === 0) {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "hours must be a non-empty array",
                },
            });
        }

        for (const entry of hours) {
            const dayOfWeek = dayOfWeekToInt(entry.dayOfWeek);

            if (dayOfWeek === null) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_REQUEST",
                        message: `Invalid dayOfWeek: ${entry.dayOfWeek}`,
                    },
                });
            }

            await prisma.clinicOperatingHour.upsert({
                where: {
                    clinicId_dayOfWeek: {
                        clinicId,
                        dayOfWeek,
                    },
                },
                update: {
                    openingTime: entry.isClosed ? null : parseTime(entry.openingTime),
                    closingTime: entry.isClosed ? null : parseTime(entry.closingTime),
                    isClosed: !!entry.isClosed,
                },
                create: {
                    clinicId,
                    dayOfWeek,
                    openingTime: entry.isClosed ? null : parseTime(entry.openingTime),
                    closingTime: entry.isClosed ? null : parseTime(entry.closingTime),
                    isClosed: !!entry.isClosed,
                },
            });
        }

        const updatedHours = await prisma.clinicOperatingHour.findMany({
            where: {
                clinicId,
            },
            orderBy: {
                dayOfWeek: "asc",
            },
        });

        return res.status(200).json({
            data: updatedHours.map((hour) => ({
                id: hour.id.toString(),
                dayOfWeek: DAYS_OF_WEEK[hour.dayOfWeek],
                openingTime: formatTime(hour.openingTime),
                closingTime: formatTime(hour.closingTime),
                isClosed: hour.isClosed,
            })),
        });
    } catch (error) {
        logError("Update clinic operating hours failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to update operating hours",
            },
        });
    }
};

export const getClinicDoctors = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const doctorClinics = await prisma.doctorClinic.findMany({
            where: {
                clinicId,
            },
            include: {
                doctorProfile: {
                    include: {
                        user: true,
                        doctorSpecialties: {
                            include: {
                                specialty: true,
                            },
                        },
                    },
                },
            },
        });

        return res.status(200).json({
            data: doctorClinics.map(({ doctorProfile }) => ({
                id: doctorProfile.id.toString(),
                userId: doctorProfile.userId.toString(),
                firstName: doctorProfile.user.firstName,
                lastName: doctorProfile.user.lastName,
                licenseNumber: doctorProfile.licenseNumber,
                bio: doctorProfile.bio,
                yearsOfExperience: doctorProfile.yearsOfExperience,
                isVerified: doctorProfile.isVerified,
                specialties: doctorProfile.doctorSpecialties.map(
                    (doctorSpecialty) => ({
                        id: doctorSpecialty.specialty.id.toString(),
                        name: doctorSpecialty.specialty.name,
                    })
                ),
            })),
        });
    } catch (error) {
        logError("Get clinic doctors failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve clinic doctors",
            },
        });
    }
};

export const getClinicServices = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const clinicServices = await prisma.clinicService.findMany({
            where: {
                clinicId,
            },
            include: {
                service: true,
            },
        });

        return res.status(200).json({
            data: clinicServices.map(({ service }) => ({
                id: service.id.toString(),
                name: service.name,
                description: service.description,
                durationMinutes: service.durationMinutes,
                status: service.status,
            })),
        });
    } catch (error) {
        logError("Get clinic services failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve clinic services",
            },
        });
    }
};

export const addClinicService = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        const { serviceId } = req.body;

        let parsedServiceId: bigint;

        try {
            parsedServiceId = BigInt(serviceId);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "serviceId is required and must be a valid numeric identifier",
                },
            });
        }

        const [clinic, service] = await Promise.all([
            prisma.clinic.findUnique({ where: { id: clinicId } }),
            prisma.service.findUnique({ where: { id: parsedServiceId } }),
        ]);

        if (!clinic || !service) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Clinic or service not found",
                },
            });
        }

        await prisma.clinicService.create({
            data: {
                clinicId,
                serviceId: parsedServiceId,
            },
        });

        return res.status(201).json({
            clinicId: clinicId.toString(),
            serviceId: parsedServiceId.toString(),
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This service is already linked to this clinic",
                },
            });
        }

        logError("Add clinic service failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to add service to clinic",
            },
        });
    }
};

export const removeClinicService = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;
        let serviceId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
            serviceId = BigInt(req.params.serviceId as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id and serviceId must be valid numeric identifiers",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        await prisma.clinicService.delete({
            where: {
                clinicId_serviceId: {
                    clinicId,
                    serviceId,
                },
            },
        });

        return res.status(200).json({
            clinicId: clinicId.toString(),
            serviceId: serviceId.toString(),
            removed: true,
        });
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "This service is not linked to this clinic",
                },
            });
        }

        logError("Remove clinic service failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to remove service from clinic",
            },
        });
    }
};

// Flat alias for addClinicService: clinicId comes from the request body instead of the URL
export const createClinicService = async (req: Request, res: Response) => {
    try {
        const { clinicId, serviceId } = req.body;

        let parsedClinicId: bigint;
        let parsedServiceId: bigint;

        try {
            parsedClinicId = BigInt(clinicId);
            parsedServiceId = BigInt(serviceId);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "clinicId and serviceId are required and must be valid numeric identifiers",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, parsedClinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        const [clinic, service] = await Promise.all([
            prisma.clinic.findUnique({ where: { id: parsedClinicId } }),
            prisma.service.findUnique({ where: { id: parsedServiceId } }),
        ]);

        if (!clinic || !service) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Clinic or service not found",
                },
            });
        }

        await prisma.clinicService.create({
            data: {
                clinicId: parsedClinicId,
                serviceId: parsedServiceId,
            },
        });

        return res.status(201).json({
            clinicId: parsedClinicId.toString(),
            serviceId: parsedServiceId.toString(),
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This service is already linked to this clinic",
                },
            });
        }

        logError("Create clinic service failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to add service to clinic",
            },
        });
    }
};

export const getClinicUsers = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        const clinicUsers = await prisma.clinicUser.findMany({
            where: { clinicId },
            include: {
                user: {
                    include: {
                        userRoles: { include: { role: true } },
                    },
                },
            },
        });

        return res.status(200).json({
            data: clinicUsers.map(({ user }) => ({
                id: user.id.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                roles: user.userRoles.map((userRole) => userRole.role.name),
                status: user.status,
            })),
        });
    } catch (error) {
        logError("Get clinic users failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to retrieve clinic users",
            },
        });
    }
};

export const addClinicUser = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id must be a valid numeric identifier",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        let userId: bigint;

        try {
            userId = BigInt(req.body.userId);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "userId is required and must be a valid numeric identifier",
                },
            });
        }

        const [clinic, user] = await Promise.all([
            prisma.clinic.findUnique({ where: { id: clinicId } }),
            prisma.user.findUnique({ where: { id: userId } }),
        ]);

        if (!clinic || !user) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Clinic or user not found",
                },
            });
        }

        await prisma.clinicUser.create({
            data: {
                clinicId,
                userId,
            },
        });

        return res.status(201).json({
            clinicId: clinicId.toString(),
            userId: userId.toString(),
        });
    } catch (error: any) {
        if (error?.code === "P2002") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This user is already linked to this clinic",
                },
            });
        }

        logError("Add clinic user failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to add user to clinic",
            },
        });
    }
};

export const removeClinicUser = async (req: Request, res: Response) => {
    try {
        let clinicId: bigint;
        let userId: bigint;

        try {
            clinicId = BigInt(req.params.id as string);
            userId = BigInt(req.params.userId as string);
        } catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_REQUEST",
                    message: "id and userId must be valid numeric identifiers",
                },
            });
        }

        const currentUser = res.locals.user;

        if (!(await canManageClinic(currentUser, clinicId))) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You do not have permission to manage this clinic",
                },
            });
        }

        await prisma.clinicUser.delete({
            where: {
                clinicId_userId: {
                    clinicId,
                    userId,
                },
            },
        });

        return res.status(200).json({
            clinicId: clinicId.toString(),
            userId: userId.toString(),
            removed: true,
        });
    } catch (error: any) {
        if (error?.code === "P2025") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "This user is not linked to this clinic",
                },
            });
        }

        logError("Remove clinic user failed:", error);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to remove user from clinic",
            },
        });
    }
};

