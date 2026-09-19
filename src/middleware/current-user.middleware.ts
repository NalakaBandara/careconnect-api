import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';

export const loadCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const sub = req.auth?.payload?.sub;

        if (!sub) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authenticated user identity not found'
                }
            });
        }

        let userId: bigint;

        try {
            userId = BigInt(sub);
        } catch {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid user identity in access token'
                }
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId
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