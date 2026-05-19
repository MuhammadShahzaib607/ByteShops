import Store from "../models/Store.js";
import { sendRes } from "./responseHandler.js";

export const verifyStoreOwner = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const storeId = req.body?.storeId || req.params?.storeId;
    console.log(storeId)

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required for verification");
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return sendRes(res, 404, false, "Store not found");
    }

    if (store.ownerId.toString() !== userId.toString()) {
      return sendRes(res, 403, false, "Access Denied: You are not the owner of this store");
    }

    req.store = store;

    next();
  } catch (error) {
    console.error("Verify Store Owner Middleware Error:", error);
    return sendRes(res, 500, false, "Internal server error during verification");
  }
};