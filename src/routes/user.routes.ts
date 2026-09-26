import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import {
    getUsers,
    getMyProfile,
    createUser,
    updateMyProfile,
    getUserById,
    updateUserById,
    anonymiseUser,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), getUsers);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createUser);
router.get("/me", checkJwt, loadCurrentUser, getMyProfile);
router.put("/me", checkJwt, loadCurrentUser, updateMyProfile);
router.get("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), getUserById);
router.put("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), updateUserById);
// ADMIN, or the account's own owner, may anonymise it (ownership checked inside the controller)
router.patch("/:id", checkJwt, loadCurrentUser, anonymiseUser);

export default router;
