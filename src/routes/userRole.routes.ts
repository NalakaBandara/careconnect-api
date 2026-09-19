import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { assignUserRole } from "../controllers/role.controller.js";

const router = Router();

router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), assignUserRole);

export default router;
