import { sendRes } from './responseHandler.js';

export const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return sendRes(res, 401, false, "Unauthorized. Authentication required.");
    }

    if (!req.user.isAdmin) {
      return sendRes(res, 403, false, "Access denied. Admin privileges required.");
    }

    next();
  } catch (error) {
    console.error("Admin Verification Error:", error);
    return sendRes(res, 500, false, "Internal server error");
  }
};