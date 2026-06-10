import express from "express"
import { editProfile, getAllUsers, getMe, login, logout, signup, validateToken } from "../controllers/auth.js"
import { verifyToken } from "../utils/verifyToken.js"
import { verifyAdmin } from "../utils/verifyAdmin.js"
import { authLimiter, creationLimiter, generalLimiter } from "../utils/rateLimiter.js"

const router = express.Router()

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/validate-token", validateToken);
router.get("/profile", generalLimiter, verifyToken, getMe);
router.put("/edit-profile", creationLimiter, verifyToken, editProfile);
router.get("/all", generalLimiter, verifyToken, verifyAdmin, getAllUsers);

export default router;