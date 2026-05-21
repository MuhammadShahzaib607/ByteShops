import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { createStore, editStore, getSingleStore, getUserStores } from "../controllers/store.js"
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js"
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js"

const router = express.Router()

router.post("/create", creationLimiter, verifyToken, createStore);
router.put("/edit", creationLimiter, verifyToken, verifyStoreOwner, editStore);
router.get("/my-stores", verifyToken, getUserStores);
router.get("/:storeId", generalLimiter, verifyToken, getSingleStore);

export default router;