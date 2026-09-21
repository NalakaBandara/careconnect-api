import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { optionalAuth } from "../middleware/optional-auth.middleware.js";
import {
    getServices,
    getServiceById,
    createService,
    updateService,
} from "../controllers/service.controller.js";

const router = Router();

// Browsing services is public: guests (no Authorization header) only see ACTIVE services
router.get("/", optionalAuth, getServices);
router.get("/:id", checkJwt, loadCurrentUser, getServiceById);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createService);
router.put("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), updateService);

export default router;
