import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { createDoctorSpecialty } from "../controllers/doctor.controller.js";

const router = Router();

// Flat alias for POST /doctors/:doctorId/specialties; permission checked inside the controller
router.post("/", checkJwt, loadCurrentUser, createDoctorSpecialty);

export default router;
