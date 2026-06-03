import express from "express";
import { verifyToken } from "../utils/verifyToken.js";
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js";
import { deleteNotifications, getUserNotifications, markNotificationsAsRead } from "../controllers/notification.js";

const router = express.Router()

router.get("/my-notifications", generalLimiter, verifyToken, getUserNotifications)
router.put("/mark-read", creationLimiter, verifyToken, markNotificationsAsRead);
router.delete("/delete-bulk", verifyToken, deleteNotifications)

export default router;