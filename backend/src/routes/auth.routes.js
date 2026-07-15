import express from "express";
import { register, login, getCurrentUser, updatePreferredLanguage } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getCurrentUser);
router.patch("/me/language", requireAuth, updatePreferredLanguage);

export default router;
