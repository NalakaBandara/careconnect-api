import express from 'express';
import { prisma } from './config/prisma.js';
import { checkJwt } from './middleware/auth0.middleware.js';
import { loadCurrentUser } from './middleware/current-user.middleware.js';
import userRoutes from "./routes/user.routes.js";

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


export default app;