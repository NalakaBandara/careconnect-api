import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { loadCurrentUser } from "../middleware/current-user.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { optionalAuth } from "../middleware/optional-auth.middleware.js";
import {
    getClinics,
    getClinicById,
    createClinic,
    updateClinic,
    deleteClinic,
    getClinicOperatingHours,
    createClinicOperatingHour,
    updateClinicOperatingHours,
    getClinicDoctors,
    getClinicServices,
    addClinicService,
    removeClinicService,
    getClinicUsers,
    addClinicUser,
    removeClinicUser,
} from "../controllers/clinic.controller.js";

const router = Router();

// Browsing clinics is public: guests (no Authorization header) get a reduced view, logged-in users the full one
router.get("/", optionalAuth, getClinics);
router.get("/:id", checkJwt, loadCurrentUser, getClinicById);
router.post("/", checkJwt, loadCurrentUser, requireRoles("ADMIN"), createClinic);
router.put("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN", "CLINIC_ADMIN"), updateClinic);
router.delete("/:id", checkJwt, loadCurrentUser, requireRoles("ADMIN"), deleteClinic);
router.get("/:id/operating-hours", checkJwt, loadCurrentUser, getClinicOperatingHours);
router.post(
    "/:id/operating-hours",
    checkJwt,
    loadCurrentUser,
    requireRoles("ADMIN", "CLINIC_ADMIN"),
    createClinicOperatingHour
);
router.put(
    "/:id/operating-hours",
    checkJwt,
    loadCurrentUser,
    requireRoles("ADMIN", "CLINIC_ADMIN"),
    updateClinicOperatingHours
);
router.get("/:id/doctors", checkJwt, loadCurrentUser, getClinicDoctors);
router.get("/:id/services", checkJwt, loadCurrentUser, getClinicServices);
router.post(
    "/:id/services",
    checkJwt,
    loadCurrentUser,
    requireRoles("ADMIN", "CLINIC_ADMIN"),
    addClinicService
);
router.delete(
    "/:id/services/:serviceId",
    checkJwt,
    loadCurrentUser,
    requireRoles("ADMIN", "CLINIC_ADMIN"),
    removeClinicService
);
router.get(
    "/:id/users",
    checkJwt,
    loadCurrentUser,
    requireRoles("ADMIN", "CLINIC_ADMIN"),
    getClinicUsers
);
router.post(
    "/:id/users",
    checkJwt,
    loadCurrentUser,
    requireRoles("ADMIN", "CLINIC_ADMIN"),
    addClinicUser
);
router.delete(
    "/:id/users/:userId",
    checkJwt,
    loadCurrentUser,
    requireRoles("ADMIN", "CLINIC_ADMIN"),
    removeClinicUser
);

export default router;
