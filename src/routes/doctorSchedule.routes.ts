import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import {
    getDoctorSchedulesFlat,
    createDoctorScheduleFlat,
    updateDoctorScheduleFlat,
} from "../controllers/doctor.controller.js";

const router = Router();

router.get("/", checkJwt, loadCurrentUser, getDoctorSchedulesFlat);
router.post("/", checkJwt, loadCurrentUser, createDoctorScheduleFlat);
router.put("/:id", checkJwt, loadCurrentUser, updateDoctorScheduleFlat);

export default router;
