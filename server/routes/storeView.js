import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { getStoreViewsAnalytics, trackStoreView } from "../controllers/storeView.js";
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js";
import { generalLimiter } from "../utils/rateLimiter.js";

const router = express.Router()

router.post("/count", generalLimiter, verifyToken, trackStoreView);
router.get("/analytics/:storeId", generalLimiter, verifyToken, verifyStoreOwner, getStoreViewsAnalytics);

export default router;