import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import {
    getServices,
    getServiceById,
    createService,
    updateService,
} from "../controllers/service.controller.js";

const router = Router();

// Browsing services is open to any authenticated human (patients need this to book appointments)
router.get("/", checkJwt, loadCurrentUser, getServices);
router.get("/:id", checkJwt, loadCurrentUser, getServiceById);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createService);
router.put("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), updateService);

export default router;
