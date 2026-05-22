import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js";
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js";
import { addService, deleteService, editService, getAllServicesGlobal, getOwnerServicesInventory, getSingleService, getStoreServices } from "../controllers/Service.js";

const router = express.Router()

router.get("/store-services/:storeId", generalLimiter, verifyToken, getStoreServices)
router.get("/all", generalLimiter, verifyToken, getAllServicesGlobal)
router.get("/my-inventory/:storeId", generalLimiter, verifyToken, verifyStoreOwner, getOwnerServicesInventory)
router.put("/:serviceId", creationLimiter, verifyToken, verifyStoreOwner, editService)
router.delete("/:serviceId", verifyToken, verifyStoreOwner, deleteService)
router.post("/:storeId", creationLimiter, verifyToken, verifyStoreOwner, addService)
router.get("/:serviceId", generalLimiter, verifyToken, getSingleService)


export default router;