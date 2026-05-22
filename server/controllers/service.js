import Service from '../models/Service.js';
import redisClient from '../utils/redisClient.js';
import { sendRes } from '../utils/responseHandler.js';

export const addService = async (req, res) => {
  try {
    const storeId = req.store._id;
    const storeType = req.store.type;
    const storeCategory = req.store.category;
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
      timeSlots: timeSlots || [],
      category: storeCategory
    });

    const savedService = await newService.save();

    if (redisClient && redisClient.isOpen) {
      const storeServicesCacheKey = `store:services:${storeId}`;
      const inventoryCacheKey = `store:inventory:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;

      const serviceCat = newService.category ? newService.category.toLowerCase() : 'all';

      Promise.all([
        redisClient.del(storeServicesCacheKey),
        redisClient.del(inventoryCacheKey),
        redisClient.del(ownerStoresCacheKey),
        redisClient.del(`services:global:cat:all:page:1:limit:12`),
        redisClient.del(`services:global:cat:${serviceCat}:page:1:limit:12`)
      ]).catch(err => console.error("Redis Delete Error:", err)); 
    }

    return sendRes(res, 201, true, "Service added successfully", savedService);

  } catch (error) {
    console.error("Add Service Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getStoreServices = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required");
    }

    const servicesCacheKey = `store:services:${storeId}`;

    if (redisClient && redisClient.isOpen) {
      const cachedServices = await redisClient.get(servicesCacheKey);
      
      if (cachedServices) {
        return sendRes(
          res, 
          200, 
          true, 
          "Services fetched successfully from cache", 
          JSON.parse(cachedServices)
        );
      }
    }

    const services = await Service.find({ storeId, isActive: true })
      .select('name price discountedPrice duration _id')
      .sort({ createdAt: -1 });

    if (!services || services.length === 0) {
      return sendRes(res, 404, false, "No active services found for this store");
    }

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        servicesCacheKey, 
        3600, 
        JSON.stringify(services)
      );
    }

    return sendRes(res, 200, true, "Services fetched successfully from database", services);

  } catch (error) {
    console.error("Get Store Services Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getSingleService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!serviceId) {
      return sendRes(res, 400, false, "Service ID is required");
    }

    const serviceCacheKey = `service:${serviceId}`;

    if (redisClient && redisClient.isOpen) {
      const cachedService = await redisClient.get(serviceCacheKey);
      
      if (cachedService) {
        return sendRes(
          res, 
          200, 
          true, 
          "Service details fetched successfully from cache", 
          JSON.parse(cachedService)
        );
      }
    }

    const service = await Service.findById(serviceId).populate({
      path: 'storeId',
      select: 'storeName logo'
    });

    if (!service) {
      return sendRes(res, 404, false, "Service not found");
    }

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        serviceCacheKey, 
        3600, 
        JSON.stringify(service)
      );
    }

    return sendRes(res, 200, true, "Service details fetched successfully from database", service);

  } catch (error) {
    console.error("Get Single Service Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getAllServicesGlobal = async (req, res) => {
  try {
    const { category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12; 
    const skip = (page - 1) * limit;

    const queryConditions = { isActive: true };

    let cacheCategoryKey = "all";
    if (category && category.trim() !== "") {
      const sanitizedCategory = category.trim();
      
      queryConditions.category = { $regex: new RegExp(sanitizedCategory, 'i') };
      
      cacheCategoryKey = sanitizedCategory.replace(/\s+/g, '-').toLowerCase();
    }

    const globalServicesCacheKey = `services:global:cat:${cacheCategoryKey}:page:${page}:limit:${limit}`;

    if (redisClient && redisClient.isOpen) {
      const cachedServices = await redisClient.get(globalServicesCacheKey);
      if (cachedServices) {
        return sendRes(
          res, 
          200, 
          true, 
          "Global services fetched successfully from cache", 
          JSON.parse(cachedServices)
        );
      }
    }

    const [services, totalServices] = await Promise.all([
      Service.find(queryConditions)
        .populate({
          path: 'storeId',
          select: 'name logo'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Service.countDocuments(queryConditions)
    ]);

    const hasMore = skip + services.length < totalServices;

    const responseData = {
      services,
      meta: {
        totalServices,
        currentPage: page,
        limit,
        hasMore 
      }
    };

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        globalServicesCacheKey, 
        3600, 
        JSON.stringify(responseData)
      );
    }

    return sendRes(res, 200, true, "Global services fetched successfully from database", responseData);

  } catch (error) {
    console.error("Get Global Services Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const editService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const storeId = req.store._id;
    const ownerId = req.user.userId;
    const category = req.store.category;

    const {
      name,
      description,
      price,
      discountedPrice,
      duration,
      availableDays,
      timeSlots,
      isActive,
    } = req.body || {};

    if (!serviceId) {
      return sendRes(res, 400, false, "Service ID is required");
    }

    const service = await Service.findOne({ _id: serviceId, storeId });
    if (!service) {
      return sendRes(res, 404, false, "Service not found in your store");
    }

    const updateFields = {};

    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (category !== undefined) updateFields.category = category.trim();
    if (duration !== undefined) updateFields.duration = duration.trim();
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    
    if (availableDays !== undefined) {
      if (!Array.isArray(availableDays)) {
        return sendRes(res, 400, false, "Available days must be an array");
      }
      updateFields.availableDays = availableDays;
    }

    if (timeSlots !== undefined) {
      if (!Array.isArray(timeSlots)) {
        return sendRes(res, 400, false, "Time slots must be an array");
      }
      updateFields.timeSlots = timeSlots;
    }

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return sendRes(res, 400, false, "Price must be a valid number greater than 0");
      }
      if (parsedPrice < 100) {
        return sendRes(res, 400, false, "Minimum service price must be Rs. 100");
      }
      updateFields.price = parsedPrice;
    }

    const finalPrice = updateFields.price !== undefined ? updateFields.price : service.price;

    if (discountedPrice !== undefined) {
      const parsedDiscountedPrice = Number(discountedPrice);
      if (isNaN(parsedDiscountedPrice) || parsedDiscountedPrice < 0) {
        return sendRes(res, 400, false, "Discounted price cannot be negative");
      }

      if (parsedDiscountedPrice > 0) {
        if (parsedDiscountedPrice >= finalPrice) {
          return sendRes(res, 400, false, "Discounted price must be less than the original price");
        }
        if (parsedDiscountedPrice < 100) {
          return sendRes(res, 400, false, "Minimum discounted price must be Rs. 100");
        }
      }
      updateFields.discountedPrice = parsedDiscountedPrice;
    } else if (updateFields.price !== undefined && service.discountedPrice > 0) {
      if (service.discountedPrice >= finalPrice) {
        return sendRes(res, 400, false, "Updated price cannot be less than or equal to existing discounted price");
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return sendRes(res, 400, false, "No fields provided for update");
    }

    const updatedService = await Service.findByIdAndUpdate(
      serviceId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (redisClient && redisClient.isOpen) {
      const singleServiceCacheKey = `service:${serviceId}`;
      const storeServicesCacheKey = `store:services:${storeId}`;
      const inventoryCacheKey = `store:inventory:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;

      const oldServiceCat = service.category ? service.category.toLowerCase() : 'all';
      const newServiceCat = updatedService.category ? updatedService.category.toLowerCase() : 'all';

      await Promise.all([
        redisClient.del(singleServiceCacheKey),
        redisClient.del(storeServicesCacheKey),
        redisClient.del(inventoryCacheKey),
        redisClient.del(ownerStoresCacheKey),
        redisClient.del(`services:global:cat:all:page:1:limit:12`),
        redisClient.del(`services:global:cat:${oldServiceCat}:page:1:limit:12`),
        redisClient.del(`services:global:cat:${newServiceCat}:page:1:limit:12`)
      ]);
    }

    return sendRes(res, 200, true, "Service updated successfully", updatedService);

  } catch (error) {
    console.error("Edit Service Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const storeId = req.store._id;
    const ownerId = req.user.userId;

    if (!serviceId) {
      return sendRes(res, 400, false, "Service ID is required");
    }

    const deletedService = await Service.findOneAndDelete({ 
      _id: serviceId, 
      storeId 
    });

    if (!deletedService) {
      return sendRes(res, 404, false, "Service not found or unauthorized to delete");
    }

    if (redisClient && redisClient.isOpen) {
      const singleServiceCacheKey = `service:${serviceId}`;
      const storeServicesCacheKey = `store:services:${storeId}`;
      const inventoryCacheKey = `store:inventory:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;

      const serviceCat = deletedService.category ? deletedService.category.toLowerCase() : 'all';

      Promise.all([
        redisClient.del(singleServiceCacheKey),
        redisClient.del(storeServicesCacheKey),
        redisClient.del(inventoryCacheKey),
        redisClient.del(ownerStoresCacheKey),
        redisClient.del(`services:global:cat:all:page:1:limit:12`),
        redisClient.del(`services:global:cat:${serviceCat}:page:1:limit:12`)
      ]).catch(err => console.error("Redis Delete Error:", err)); 
    }

    return sendRes(res, 200, true, "Service deleted successfully");

  } catch (error) {
    console.error("Delete Service Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getOwnerServicesInventory = async (req, res) => {
  try {
    const storeId = req.store._id;

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required");
    }

    const inventoryCacheKey = `store:inventory:services:${storeId}`;

    if (redisClient && redisClient.isOpen) {
      const cachedInventory = await redisClient.get(inventoryCacheKey);
      if (cachedInventory) {
        return sendRes(
          res, 
          200, 
          true, 
          "Owner services inventory fetched successfully from cache", 
          JSON.parse(cachedInventory)
        );
      }
    }

    const services = await Service.find({ storeId })
      .select('name price duration description discountedPrice _id')
      .sort({ createdAt: -1 });

    if (!services || services.length === 0) {
      return sendRes(res, 404, false, "No services found in your store inventory");
    }

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        inventoryCacheKey, 
        3600, 
        JSON.stringify(services)
      );
    }

    return sendRes(res, 200, true, "Owner services inventory fetched successfully from database", services);

  } catch (error) {
    console.error("Get Owner Services Inventory Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};