import express from 'express';
import { prisma } from './config/prisma.js';
import { checkJwt } from './middleware/auth0.middleware.js';
import { loadCurrentUser } from './middleware/current-user.middleware.js';
import { requireScopes } from './middleware/scope.middleware.js';
import { SCOPES } from './config/scopes.js';
import userRoutes from "./routes/user.routes.js";
import clinicRoutes from "./routes/clinic.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import specialtyRoutes from "./routes/specialty.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import roleRoutes from "./routes/role.routes.js";
import userRoleRoutes from "./routes/userRole.routes.js";
import auditLogRoutes from "./routes/auditLog.routes.js";
import clinicServiceRoutes from "./routes/clinicService.routes.js";
import doctorClinicRoutes from "./routes/doctorClinic.routes.js";
import doctorScheduleRoutes from "./routes/doctorSchedule.routes.js";
import doctorServiceRoutes from "./routes/doctorService.routes.js";
import doctorSpecialtyRoutes from "./routes/doctorSpecialty.routes.js";

const app = express();

// Middleware
app.use(express.json());

// Application health endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        application: 'Career Connect API [Node.js]',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Database health endpoint
app.get('/health/db', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            status: 'ok',
            database: 'connected'
        });
    } catch (error) {
        console.error('Database connection failed:', error);

        res.status(500).json({
            status: 'error',
            database: 'disconnected'
        });
    }
});

app.get(
    '/api/protected',
    checkJwt,
    loadCurrentUser,
    (req, res) => {
        const user = res.locals.user;

        res.status(200).json({
            message: 'You are authenticated!',
            user: {
                id: user.id.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                auth0UserId: user.auth0UserId,
                roles: user.userRoles.map(
                    (userRole: any) => userRole.role.name
                )
            }
        });
    }
);

// User routes
app.use("/api/v1/users", userRoutes);

// Clinic routes
app.use("/api/v1/clinics", clinicRoutes);

// Doctor routes
app.use("/api/v1/doctors", doctorRoutes);

// Specialty routes
app.use("/api/v1/specialties", specialtyRoutes);

// Service routes
app.use("/api/v1/services", serviceRoutes);

// Notification routes
app.use("/api/v1/notifications", notificationRoutes);

// Appointment routes
app.use("/api/v1/appointments", appointmentRoutes);

// Role management and role assignment (ADMIN only)
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/user-roles", userRoleRoutes);

// Audit log routes (ADMIN only)
app.use("/api/v1/audit-logs", auditLogRoutes);

// Flat link-table routes; body carries both ids, permissions are checked in the controllers
app.use("/api/v1/clinic-services", clinicServiceRoutes);
app.use("/api/v1/doctor-clinics", doctorClinicRoutes);
app.use("/api/v1/doctor-schedules", doctorScheduleRoutes);
app.use("/api/v1/doctor-services", doctorServiceRoutes);
app.use("/api/v1/doctor-specialties", doctorSpecialtyRoutes);

// M2M (client_credentials) demo endpoint - authorized via scope, not user roles
app.get(
    '/api/m2m/ping',
    checkJwt,
    requireScopes(SCOPES.READ_SYSTEM),
    (req, res) => {
        res.status(200).json({
            message: 'M2M token authorized',
            clientId: req.auth?.payload?.sub,
            scopes: (req.auth?.payload?.scope as string | undefined)?.split(' ') ?? []
        });
    }
);


export default app;