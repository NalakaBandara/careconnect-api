import { Request, Response, NextFunction } from "express";

// Requires loadCurrentUser to have run first so res.locals.user.userRoles is populated.
export const requireRoles = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = res.locals.user;

        const userRoleNames: string[] =
            user?.userRoles?.map((userRole: any) => userRole.role.name) ?? [];

        const hasRole = allowedRoles.some((role) =>
            userRoleNames.includes(role)
        );

        if (!hasRole) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: `Requires one of the following roles: ${allowedRoles.join(", ")}`,
                },
            });
        }

        next();
    };
};
