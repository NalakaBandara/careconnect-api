import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import {
    getAppointments,
    getMyAppointments,
    getAppointmentById,
    createAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    getAppointmentStatusHistory,
} from "../controllers/appointment.controller.js";
import { getCheckIn, createCheckIn } from "../controllers/checkin.controller.js";

const router = Router();

// ADMIN-only cross-user listing with filters; must be registered before "/:id"
router.get("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), getAppointments);
// Any authenticated human can view their own appointments (as patient or as assigned doctor)
router.get("/me", checkJwt, loadCurrentUser, getMyAppointments);
// Access is scoped inside the controller (owner, assigned doctor, or clinic staff/admin)
router.get("/:id", checkJwt, loadCurrentUser, getAppointmentById);
router.post("/", checkJwt, loadCurrentUser, createAppointment);
router.patch("/:id", checkJwt, loadCurrentUser, updateAppointmentStatus);
router.delete("/:id", checkJwt, loadCurrentUser, cancelAppointment);
router.get("/:id/status-history", checkJwt, loadCurrentUser, getAppointmentStatusHistory);
// Access is scoped inside the controller (owner, assigned doctor, or clinic staff/admin)
router.get("/:appointmentId/check-in", checkJwt, loadCurrentUser, getCheckIn);
router.post("/:appointmentId/check-in", checkJwt, loadCurrentUser, createCheckIn);

export default router;
