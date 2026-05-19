import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { getStoreViewsAnalytics, trackStoreView } from "../controllers/storeView.js";
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js";

const router = express.Router()

router.post("/count", verifyToken, trackStoreView)
router.get("/analytics/:storeId", verifyToken, verifyStoreOwner, getStoreViewsAnalytics)

export default router;