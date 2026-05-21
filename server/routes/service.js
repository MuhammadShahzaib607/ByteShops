import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js";
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js";
import { addService } from "../controllers/Service.js";

const router = express.Router()

router.post("/:storeId", creationLimiter, verifyToken, verifyStoreOwner, addService)

export default router;