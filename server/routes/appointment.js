import express from "express"
import { createAppointment, getCustomerAppointments, getSingleAppointment, getStoreAppointments, updateAppointmentPaymentStatus, updateAppointmentStatus } from "../controllers/appointment.js";
import { verifyToken } from "../utils/verifyToken.js";
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js";
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js";

const router = express.Router()

router.post("/", creationLimiter, verifyToken, createAppointment);
router.get("/customer", generalLimiter, verifyToken, getCustomerAppointments);
// router.get("/booked-slots", generalLimiter, verifyToken, getBookedSlots)
router.get("/store/:storeId", generalLimiter, verifyToken, verifyStoreOwner, getStoreAppointments);
router.patch("/:appointmentId/status", verifyToken, updateAppointmentStatus);
router.patch("/:appointmentId/paymentStatus", verifyToken, updateAppointmentPaymentStatus);
router.get("/:appointmentId", generalLimiter, verifyToken, getSingleAppointment);

export default router;