import express from "express"
import { verifyToken } from "../utils/verifyToken.js"
import { addProduct, deleteProduct, editProduct, getAllProductsGlobal, getSingleProduct, getOwnerProductInventory, getStoreProducts } from "../controllers/product.js";
import { verifyStoreOwner } from "../utils/verifyStoreOwner.js";
import { creationLimiter, generalLimiter } from "../utils/rateLimiter.js";

const router = express.Router()

router.post("/", creationLimiter, verifyToken, verifyStoreOwner, addProduct);
router.get('/all', generalLimiter, verifyToken, getAllProductsGlobal);
router.get('/store-products/:storeId', generalLimiter, verifyToken, getStoreProducts);
router.get('/my-inventory/:storeId', generalLimiter, verifyToken, verifyStoreOwner, getOwnerProductInventory);
router.put("/:productId", creationLimiter, verifyToken, verifyStoreOwner, editProduct)
router.delete("/:productId", verifyToken, verifyStoreOwner, deleteProduct)
router.get('/:productId', generalLimiter, verifyToken, getSingleProduct);

export default router;