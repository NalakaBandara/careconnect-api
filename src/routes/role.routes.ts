import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { getRoles, createRole } from "../controllers/role.controller.js";

const router = Router();

router.get("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), getRoles);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createRole);

export default router;
