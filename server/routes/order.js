import express from "express"
import { createOrder, getCustomerOrders, getSingleOrder, getStoreOrders, getStoreStats, updateOrderStatus, updatePaymentStatus, uploadPaymentScreenshot } from "../controllers/order.js";
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js";
import { verifyToken } from "../utils/verifyToken.js";
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js";

const router = express.Router()

router.post("/", creationLimiter, verifyToken, createOrder)
router.get("/my-orders", generalLimiter,verifyToken, getCustomerOrders)
router.get("/store-orders/:storeId", generalLimiter, verifyToken, verifyStoreOwner, getStoreOrders)
router.get("/store-stats/:storeId", generalLimiter, verifyToken, verifyStoreOwner, getStoreStats)
router.put("/order-status/:orderId", generalLimiter, verifyToken, updateOrderStatus)
router.get("/:orderId", generalLimiter, verifyToken, getSingleOrder)
router.put("/:orderId/verify-payment", creationLimiter, verifyToken, verifyStoreOwner, updatePaymentStatus)
router.put("/:orderId/upload-screenshot", creationLimiter, verifyToken, uploadPaymentScreenshot)

export default router;