import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { isM2MToken } from './scope.middleware.js';

export const loadCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const auth0UserId = req.auth?.payload?.sub;

        if (!auth0UserId) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authenticated user identity not found'
                }
            });
        }

        if (isM2MToken(req)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Machine-to-machine tokens cannot access user endpoints'
                }
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                auth0UserId
            },
            include: {
                userRoles: {
                    include: {
                        role: true
                    }
                },
                doctorProfile: true
            }
        });

        if (!user) {
            return res.status(404).json({
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'CareConnect user not found'
                }
            });
        }

        res.locals.user = user;

        next();
    } catch (error) {
        console.error('Failed to load current user:', error);

        return res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to load current user'
            }
        });
    }
};