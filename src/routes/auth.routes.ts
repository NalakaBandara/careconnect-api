import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";
import {
    loginIpLimiter,
    loginAccountLimiter,
    registerLimiter,
} from "../middleware/rate-limit.middleware.js";

const router = Router();

// Public - no checkJwt, so these are rate limited (brute force + bcrypt CPU cost)
router.post("/register", registerLimiter, register);
router.post("/login", loginIpLimiter, loginAccountLimiter, login);

export default router;
