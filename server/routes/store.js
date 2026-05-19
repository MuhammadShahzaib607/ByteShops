import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { createStore, deleteStore, editStore, getSingleStore, getUserStores } from "../controllers/store.js"
import { verifyAdmin } from "../utils/verifyAdmin.js"
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js"

const router = express.Router()

router.post("/create", verifyToken, createStore)
router.put("/edit", verifyToken, verifyStoreOwner, editStore)
router.delete("/delete/:storeId", verifyToken, verifyStoreOwner, deleteStore)
router.get("/my-stores", verifyToken, getUserStores)
router.get("/:storeId", verifyToken, getSingleStore)

export default router;