import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import {
    getMyNotifications,
    createNotification,
    markNotificationRead,
} from "../controllers/notification.controller.js";

const router = Router();

// Notifications are scoped to the current user by default; ADMIN may pass ?userId= (checked inside the controller)
router.get("/", checkJwt, loadCurrentUser, getMyNotifications);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createNotification);
router.patch("/:id/read", checkJwt, loadCurrentUser, markNotificationRead);

export default router;
