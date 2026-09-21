import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { slotsLimiter } from "../middleware/rate-limit.middleware.js";
import { optionalAuth } from "../middleware/optional-auth.middleware.js";
import {
    getDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    getDoctorSchedules,
    createDoctorSchedule,
    updateDoctorSchedule,
    getDoctorAvailableSlots,
    addDoctorSpecialty,
    removeDoctorSpecialty,
    addDoctorClinic,
    removeDoctorClinic,
} from "../controllers/doctor.controller.js";

const router = Router();

// Browsing doctors is public: guests (no Authorization header) get a reduced view, logged-in users the full one
router.get("/", optionalAuth, getDoctors);
router.get("/:id", checkJwt, loadCurrentUser, getDoctorById);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createDoctor);
router.put("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), updateDoctor);
router.get("/:id/schedules", checkJwt, loadCurrentUser, getDoctorSchedules);
// Schedule management: ADMIN, or the doctor themselves (checked inside the controller)
router.post("/:id/schedules", checkJwt, loadCurrentUser, createDoctorSchedule);
router.put("/:id/schedules/:scheduleId", checkJwt, loadCurrentUser, updateDoctorSchedule);
// Limiter runs first so a flood is rejected before any auth or DB work
router.get("/:id/available-slots", slotsLimiter, checkJwt, loadCurrentUser, getDoctorAvailableSlots);
// Specialty management: ADMIN, or the doctor themselves (checked inside the controller)
router.post("/:doctorId/specialties", checkJwt, loadCurrentUser, addDoctorSpecialty);
router.delete("/:doctorId/specialties/:specialtyId", checkJwt, loadCurrentUser, removeDoctorSpecialty);
// Clinic assignment management: ADMIN, or the doctor themselves (checked inside the controller)
router.post("/:doctorId/clinics", checkJwt, loadCurrentUser, addDoctorClinic);
router.delete("/:doctorId/clinics/:clinicId", checkJwt, loadCurrentUser, removeDoctorClinic);

export default router;
