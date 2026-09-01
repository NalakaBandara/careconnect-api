import { Router } from "express";
import { checkJwt } from "../middleware/auth0.middleware.js";
import { getMyProfile } from "../controllers/user.controller.js";

const router = Router();

router.get("/me", checkJwt, getMyProfile);

export default router;