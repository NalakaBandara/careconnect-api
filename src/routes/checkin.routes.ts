import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { getCheckIn, createCheckInFlat } from "../controllers/checkin.controller.js";

const router = Router();

// Flat aliases for /appointments/:appointmentId/check-in; permission checked inside the controllers
router.post("/", checkJwt, loadCurrentUser, createCheckInFlat);
router.get("/:appointmentId", checkJwt, loadCurrentUser, getCheckIn);

export default router;
