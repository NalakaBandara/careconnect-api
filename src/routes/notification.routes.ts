import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import {
    getMyNotifications,
    markNotificationRead,
} from "../controllers/notification.controller.js";

const router = Router();

// Notifications are always scoped to the current user - no cross-user access
router.get("/", checkJwt, loadCurrentUser, getMyNotifications);
router.patch("/:id/read", checkJwt, loadCurrentUser, markNotificationRead);

export default router;
