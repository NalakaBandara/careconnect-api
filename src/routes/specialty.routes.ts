import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { optionalAuth } from "../middleware/optional-auth.middleware.js";
import {
    getSpecialties,
    createSpecialty,
    updateSpecialty,
} from "../controllers/specialty.controller.js";

const router = Router();

// Browsing specialties is public (nothing sensitive in them)
router.get("/", optionalAuth, getSpecialties);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createSpecialty);
router.put("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), updateSpecialty);

export default router;
