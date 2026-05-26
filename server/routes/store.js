import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { createStore, editStore, getSingleStore, getStoresByCategory, getUserStores } from "../controllers/store.js"
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js"
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js"

const router = express.Router()

router.post("/", creationLimiter, verifyToken, createStore);
router.put("/", creationLimiter, verifyToken, verifyStoreOwner, editStore);
router.get("/my-stores", verifyToken, getUserStores);
router.get("/category/:category", generalLimiter, verifyToken, getStoresByCategory);
router.get("/:slug", generalLimiter, verifyToken, getSingleStore);

export default router;