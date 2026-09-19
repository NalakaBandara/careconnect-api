import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { createClinicService } from "../controllers/clinic.controller.js";

const router = Router();

// Flat alias for POST /clinics/:id/services; permission checked inside the controller
router.post("/", checkJwt, loadCurrentUser, createClinicService);

export default router;
