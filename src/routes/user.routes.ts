import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { rejectM2MTokens } from "../middleware/scope.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import {
    getMyProfile,
    createMyProfile,
    updateMyProfile,
    getUserById,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/me", checkJwt, loadCurrentUser, getMyProfile);
router.post("/me", checkJwt, rejectM2MTokens, createMyProfile);
router.put("/me", checkJwt, loadCurrentUser, updateMyProfile);
router.get("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), getUserById);

export default router;