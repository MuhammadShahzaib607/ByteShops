import express from "express"
import { editProfile, getAllUsers, getMe, login, signup } from "../controllers/auth.js"
import { verifyToken } from "../utils/verifyToken.js"
import { verifyAdmin } from "../utils/verifyAdmin.js"

const router = express.Router()

router.post("/signup", signup)
router.post("/login", login)
router.get("/profile", verifyToken, getMe)
router.put("/edit-profile", verifyToken, editProfile)
router.get("/all", verifyToken, verifyAdmin, getAllUsers)

export default router;