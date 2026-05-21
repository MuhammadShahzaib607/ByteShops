import Service from '../models/Service.js';
import redisClient from '../utils/redisClient.js';
import { sendRes } from '../utils/responseHandler.js';

export const addService = async (req, res) => {
  try {
    const storeId = req.store._id;
    const storeType = req.store.type;
    const ownerId = req.user.userId; 

    const {
      name,
      description,
      price,
      discountedPrice,
      duration,
      availableDays,
      timeSlots
    } = req.body || {};

    if (storeType === "RETAIL") {
      return sendRes(res, 400, false, "Access Denied: This store is registered under the RETAIL category. You can only post physical products, not appointment services.");  
    }

    if (!name || !description || price === undefined || !duration || !availableDays) {
      return sendRes(res, 400, false, "Name, description, price, duration, and available days are required fields");
    }

    if (!Array.isArray(availableDays) || availableDays.length === 0) {
      return sendRes(res, 400, false, "Available days must be a non-empty array of strings");
    }

    if (timeSlots && !Array.isArray(timeSlots)) {
      return sendRes(res, 400, false, "Time slots must be an array of strings");
    }

    const parsedPrice = Number(price);
    const parsedDuration = Number(duration);
    const parsedDiscountedPrice = discountedPrice !== undefined ? Number(discountedPrice) : 0;

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return sendRes(res, 400, false, "Price must be a valid number greater than 0");
    }

    if (isNaN(parsedDuration) || parsedDuration < 1) {
      return sendRes(res, 400, false, "Duration must be at least 1 minute");
    }

    if (parsedDiscountedPrice > 0) {
      if (parsedDiscountedPrice >= parsedPrice) {
        return sendRes(res, 400, false, "Discounted price must be less than the original price");
      }
      if (parsedDiscountedPrice < 100) {
        return sendRes(res, 400, false, "Minimum discounted price must be Rs. 100");
      }
    }

    const newService = new Service({
      storeId,
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      discountedPrice: parsedDiscountedPrice,
      duration: parsedDuration,
      availableDays,
      timeSlots: timeSlots || []
    });

    const savedService = await newService.save();

    if (redisClient && redisClient.isOpen) {
    }

    return sendRes(res, 201, true, "Service added successfully", savedService);

  } catch (error) {
    console.error("Add Service Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};