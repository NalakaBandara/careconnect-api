import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { getAuditLogs } from "../controllers/auditLog.controller.js";

const router = Router();

router.get("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), getAuditLogs);

export default router;
