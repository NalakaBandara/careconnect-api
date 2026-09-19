import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { createDoctorService } from "../controllers/doctor.controller.js";

const router = Router();

router.post("/", checkJwt, loadCurrentUser, createDoctorService);

export default router;
