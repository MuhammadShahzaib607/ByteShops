import Store from "../models/Store.js";
import User from "../models/User.js";
import redisClient from "../utils/redisClient.js";
import { sendRes } from "../utils/responseHandler.js";

export const createStore = async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const {
      storeName,
      type,
      category,
      subCategory,
      logo,
      banner,
      description,
      aiGeneratedContent,
      phone,
      socialMediaLinks,
      address,
    } = req.body;

    if (!storeName || !type || !category || !phone) {
      return sendRes(res, 400, false, "Required fields are missing");
    }

    const storeType = type.toUpperCase();
    if (!['RETAIL', 'SERVICE'].includes(storeType)) {
      return sendRes(res, 400, false, "Invalid store type");
    }

    const user = await User.findById(ownerId);
    if (!user) {
      return sendRes(res, 404, false, "User not found");
    }

    if (user.stores.length >= user.storesLimit) {
      return sendRes(res, 400, false, `Store limit reached. Maximum ${user.storesLimit} stores allowed.`);
    }

    let generatedSlug = storeName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const existingStore = await Store.findOne({ slug: generatedSlug });
    if (existingStore) {
      generatedSlug = `${generatedSlug}-${Date.now().toString().slice(-4)}`;
    }

    const newStore = new Store({
      storeName,
      slug: generatedSlug,
      ownerId,
      type: storeType,
      category,
      subCategory,
      logo,
      banner,
      description,
      aiGeneratedContent,
      phone,
      socialMediaLinks,
      address,
    });

    const savedStore = await newStore.save();

    await User.findByIdAndUpdate(ownerId, {
      $push: { stores: savedStore._id },
      $inc: { storesLimit: -1 },
    });

    await redisClient.del(`user:stores:${ownerId}`);
    return sendRes(res, 201, true, "Store created successfully", savedStore);
  } catch (error) {
    console.error("Create Store Error:", error);
    return sendRes(res, 500, false, "Internal server error" + error.message);
  }
};

export const editStore = async (req, res) => {
  try {
    const storeId = req.store._id;
    const ownerId = req.user.userId;
    const { 
      logo, 
      banner, 
      description, 
      aiGeneratedContent, 
      phone, 
      socialMediaLinks, 
      address 
    } = req.body || {};

    const updateFields = {};

    if (logo !== undefined) updateFields.logo = logo;
    if (banner !== undefined) updateFields.banner = banner;
    if (description !== undefined) updateFields.description = description.trim();
    if (aiGeneratedContent !== undefined) updateFields.aiGeneratedContent = aiGeneratedContent;
    if (phone !== undefined) updateFields.phone = phone.trim();

    if (address && typeof address === 'object') {
      if (address.street !== undefined) updateFields['address.street'] = address.street.trim();
      if (address.city !== undefined) updateFields['address.city'] = address.city.trim();
      if (address.country !== undefined) updateFields['address.country'] = address.country.trim();
    }

    if (socialMediaLinks && typeof socialMediaLinks === 'object') {
      if (socialMediaLinks.insta !== undefined) updateFields['socialMediaLinks.insta'] = socialMediaLinks.insta.trim();
      if (socialMediaLinks.fb !== undefined) updateFields['socialMediaLinks.fb'] = socialMediaLinks.fb.trim();
      if (socialMediaLinks.yt !== undefined) updateFields['socialMediaLinks.yt'] = socialMediaLinks.yt.trim();
    }

    if (Object.keys(updateFields).length === 0) {
      return sendRes(res, 400, false, "No fields provided for update");
    }

    const updatedStore = await Store.findByIdAndUpdate(
      storeId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (redisClient && redisClient.isOpen) {
      const storeCacheKey = `store:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;
      const slugCacheKey = `store:slug:${req.store.slug}`;

      await Promise.all([
        redisClient.del(storeCacheKey),
        redisClient.del(ownerStoresCacheKey),
        redisClient.del(slugCacheKey)
      ]);
    }

    return sendRes(res, 200, true, "Store updated successfully", updatedStore);

  } catch (error) {
    console.error("Edit Store Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const deleteStore = async (req, res) => {
  try {
    const storeId = req.store._id;
    const ownerId = req.user.userId;
    const storeSlug = req.store.slug;

    await Promise.all([
      Store.findByIdAndDelete(storeId),
      User.findByIdAndUpdate(ownerId, {
        $pull: { stores: storeId },
        $inc: { storesLimit: 1 }
      })
    ]);

    if (redisClient && redisClient.isOpen) {
      const storeCacheKey = `store:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;
      const slugCacheKey = `store:slug:${storeSlug}`;

      await Promise.all([
        redisClient.del(storeCacheKey),
        redisClient.del(ownerStoresCacheKey),
        redisClient.del(slugCacheKey)
      ]);
    }

    return sendRes(res, 200, true, "Store deleted successfully");

  } catch (error) {
    console.error("Delete Store Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getSingleStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required");
    }

    const cacheKey = `store:${storeId}`;

    const cachedStore = await redisClient.get(cacheKey);

    if (cachedStore) {
      // console.log("Cache Hit: Data fetched from Redis");
      const storeData = JSON.parse(cachedStore);
      return sendRes(res, 200, true, "Store data fetched successfully (cached)", storeData);
    }

    // console.log("Cache Miss: Fetching from MongoDB");

    const dbStore = await Store.findById(storeId);
    if (!dbStore) {
      return sendRes(res, 404, false, "Store not found");
    }

    const storeObject = dbStore.toObject();

    await redisClient.set(cacheKey, JSON.stringify(storeObject), {
      EX: 1800
    });

    return sendRes(res, 200, true, "Store data fetched successfully", storeObject);

  } catch (error) {
    // console.error("Get Single Store Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getUserStores = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return sendRes(res, 400, false, "User ID is required");
    }

    const cacheKey = `user:stores:${userId}`;

    const cachedStores = await redisClient.get(cacheKey);

    if (cachedStores) {
      const storesData = JSON.parse(cachedStores);
      return sendRes(res, 200, true, "User stores fetched successfully (cached)", storesData);
    }

    const dbStores = await Store.find({ ownerId: userId });

    await redisClient.set(cacheKey, JSON.stringify(dbStores), {
      EX: 1800
    });

    return sendRes(res, 200, true, "User stores fetched successfully", dbStores);
  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

