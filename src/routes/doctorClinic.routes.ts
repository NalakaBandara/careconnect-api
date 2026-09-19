import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { createDoctorClinic } from "../controllers/doctor.controller.js";

const router = Router();

// Flat alias for POST /doctors/:doctorId/clinics; permission checked inside the controller
router.post("/", checkJwt, loadCurrentUser, createDoctorClinic);

export default router;
