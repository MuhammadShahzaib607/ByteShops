import Product from '../models/Product.js';
import redisClient from '../utils/redisClient.js';
import { sendRes } from '../utils/responseHandler.js';

export const addProduct = async (req, res) => {
  try {
    const storeId = req.store._id;
    const ownerId = req.user.userId;
    const {
      name,
      description,
      imgs,
      price,
      discountedPrice,
      category,
      stock,
    } = req.body || {};

    if (!name || !description || !category || price === undefined || stock === undefined) {
      return sendRes(res, 400, false, "All mandatory fields are required");
    }

    if (!Array.isArray(imgs) || imgs.length === 0) {
      return sendRes(res, 400, false, "At least one product image is required");
    }

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);
    const parsedDiscountedPrice = discountedPrice !== undefined ? Number(discountedPrice) : 0;

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return sendRes(res, 400, false, "Price must be a valid number greater than 0");
    }

    if (isNaN(parsedStock) || parsedStock < 1) {
      return sendRes(res, 400, false, "Minimum stock must be 1");
    }

    if (parsedDiscountedPrice > 0) {
      if (parsedDiscountedPrice >= parsedPrice) {
        return sendRes(res, 400, false, "Discounted price must be less than the original price");
      }
      if (parsedDiscountedPrice < 100) {
        return sendRes(res, 400, false, "Minimum discounted price must be Rs. 100");
      }
    }

    const newProduct = new Product({
      storeId,
      name: name.trim(),
      description: description.trim(),
      imgs,
      price: parsedPrice,
      discountedPrice: parsedDiscountedPrice,
      category: category.trim(),
      stock: parsedStock,
    });

    const savedProduct = await newProduct.save();

    if (redisClient && redisClient.isOpen) {
      const storeProductsCacheKey = `store:products:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;
      const inventoryCacheKey = `store:inventory:${storeId}`;

      await Promise.all([
        redisClient.del(storeProductsCacheKey),
        redisClient.del(ownerStoresCacheKey),
        redisClient.del(inventoryCacheKey)
      ]);
    }

    const productCat = savedProduct.category ? savedProduct.category.toLowerCase() : 'all';
  await Promise.all([
    redisClient.del(`products:global:cat:all:page:1:limit:12`),
    redisClient.del(`products:global:cat:${productCat}:page:1:limit:12`)
  ]);

    return sendRes(res, 201, true, "Product added successfully", savedProduct);

  } catch (error) {
    console.error("Add Product Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getStoreProducts = async (req, res) => {
  try {
    const storeId = req?.params?.storeId;
    const storeProductsCacheKey = `store:products:${storeId}`;

    if (redisClient && redisClient.isOpen) {
      const cachedProducts = await redisClient.get(storeProductsCacheKey);

      if (cachedProducts) {
        return sendRes(
          res,
          200,
          true,
          "Products fetched successfully from cache",
          JSON.parse(cachedProducts)
        );
      }
    }

    const products = await Product.find({ storeId, isActive: true }).sort({ createdAt: -1 });

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        storeProductsCacheKey,
        3600,
        JSON.stringify(products)
      );
    }

    return sendRes(res, 200, true, "Products fetched successfully from database", products);

  } catch (error) {
    console.error("Get Store Products Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return sendRes(res, 400, false, "Product ID is required");
    }

    const productCacheKey = `product:${productId}`;

    if (redisClient && redisClient.isOpen) {
      const cachedProduct = await redisClient.get(productCacheKey);

      if (cachedProduct) {
        return sendRes(
          res,
          200,
          true,
          "Product details fetched successfully from cache",
          JSON.parse(cachedProduct)
        );
      }
    }

    const product = await Product.findOne({ _id: productId });

    if (!product) {
      return sendRes(res, 404, false, "Product not found or is currently inactive");
    }

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        productCacheKey,
        3600,
        JSON.stringify(product)
      );
    }

    return sendRes(res, 200, true, "Product details fetched successfully from database", product);

  } catch (error) {
    console.error("Get Single Product Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getOwnerProductInventory = async (req, res) => {
  try {
    const storeId = req.store._id;
    const inventoryCacheKey = `store:inventory:${storeId}`;

    if (redisClient && redisClient.isOpen) {
      const cachedInventory = await redisClient.get(inventoryCacheKey);

      if (cachedInventory) {
        return sendRes(
          res,
          200,
          true,
          "Inventory fetched successfully from cache",
          JSON.parse(cachedInventory)
        );
      }
    }

    const inventory = await Product.find({ storeId }).sort({ createdAt: -1 });

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        inventoryCacheKey,
        3600,
        JSON.stringify(inventory)
      );
    }

    return sendRes(res, 200, true, "Inventory fetched successfully from database", inventory);

  } catch (error) {
    console.error("Get Owner Inventory Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const editProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const storeId = req.store._id;
    const ownerId = req.user.userId;

    const {
      name,
      description,
      price,
      discountedPrice,
      isActive,
      stock,
      category
    } = req.body || {};

    if (!productId) {
      return sendRes(res, 400, false, "Product ID is required");
    }

    const product = await Product.findOne({ _id: productId, storeId });
    if (!product) {
      return sendRes(res, 404, false, "Product not found in your store");
    }

    const updateFields = {};

    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (category !== undefined) updateFields.category = category.trim();
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return sendRes(res, 400, false, "Price must be a valid number greater than 0");
      }
      updateFields.price = parsedPrice;
    }

    if (stock !== undefined) {
      const parsedStock = Number(stock);
      if (isNaN(parsedStock) || parsedStock < 0) {
        return sendRes(res, 400, false, "Stock cannot be negative");
      }
      updateFields.stock = parsedStock;
    }

    const finalPrice = updateFields.price !== undefined ? updateFields.price : product.price;

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
    } else if (updateFields.price !== undefined && product.discountedPrice > 0) {
      if (product.discountedPrice >= finalPrice) {
        return sendRes(res, 400, false, "Updated price cannot be less than or equal to existing discounted price");
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return sendRes(res, 400, false, "No fields provided for update");
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (redisClient && redisClient.isOpen) {
      const singleProductCacheKey = `product:${productId}`;
      const storeProductsCacheKey = `store:products:${storeId}`;
      const inventoryCacheKey = `store:inventory:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;
      
      const oldProductCat = product.category ? product.category.toLowerCase() : 'all';
      const newProductCat = updatedProduct.category ? updatedProduct.category.toLowerCase() : 'all';

      await Promise.all([
        redisClient.del(singleProductCacheKey),
        redisClient.del(storeProductsCacheKey),
        redisClient.del(inventoryCacheKey),
        redisClient.del(ownerStoresCacheKey),
        redisClient.del(`products:global:cat:all:page:1:limit:12`),
        redisClient.del(`products:global:cat:${oldProductCat}:page:1:limit:12`),
        redisClient.del(`products:global:cat:${newProductCat}:page:1:limit:12`) 
      ]);
    }

    return sendRes(res, 200, true, "Product updated successfully", updatedProduct);

  } catch (error) {
    console.error("Edit Product Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const storeId = req.store._id;
    const ownerId = req.user.userId;

    if (!productId) {
      return sendRes(res, 400, false, "Product ID is required");
    }

    const deletedProduct = await Product.findOneAndDelete({ _id: productId, storeId });

    if (!deletedProduct) {
      return sendRes(res, 404, false, "Product not found or you don't have permission to delete it");
    }

    if (redisClient && redisClient.isOpen) {
      const singleProductCacheKey = `product:${productId}`;
      const storeProductsCacheKey = `store:products:${storeId}`;
      const inventoryCacheKey = `store:inventory:${storeId}`;
      const ownerStoresCacheKey = `user:stores:${ownerId}`;

      await Promise.all([
        redisClient.del(singleProductCacheKey),
        redisClient.del(storeProductsCacheKey),
        redisClient.del(inventoryCacheKey),
        redisClient.del(ownerStoresCacheKey)
      ]);
    }

    const productCat = deletedProduct.category ? deletedProduct.category.toLowerCase() : 'all';
  await Promise.all([
    redisClient.del(`products:global:cat:all:page:1:limit:12`),
    redisClient.del(`products:global:cat:${productCat}:page:1:limit:12`)
  ]);

    return sendRes(res, 200, true, "Product deleted successfully from database and cache");

  } catch (error) {
    console.error("Delete Product Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getAllProductsGlobal = async (req, res) => {
  try {
    const { category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const queryConditions = { isActive: true };

    let cacheCategoryKey = "all";
    if (category && category.trim() !== "") {
      const sanitizedCategory = category.trim().toLowerCase();
      queryConditions.category = { $regex: new RegExp(`^${sanitizedCategory}$`, 'i') };
      cacheCategoryKey = sanitizedCategory;
    }

    const globalProductsCacheKey = `products:global:cat:${cacheCategoryKey}:page:${page}:limit:${limit}`;

    if (redisClient && redisClient.isOpen) {
      const cachedProducts = await redisClient.get(globalProductsCacheKey);
      if (cachedProducts) {
        return sendRes(
          res,
          200,
          true,
          "Global products fetched successfully from cache",
          JSON.parse(cachedProducts)
        );
      }
    }

    const [products, totalProducts] = await Promise.all([
      Product.find(queryConditions)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "storeId",
          select: "storeName logo"
        })
        ,
      Product.countDocuments(queryConditions)
    ]);

    const hasMore = skip + products.length < totalProducts;

    const responseData = {
      products,
      meta: {
        totalProducts,
        currentPage: page,
        limit,
        hasMore
      }
    };

    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        globalProductsCacheKey,
        3600,
        JSON.stringify(responseData)
      );
    }

    return sendRes(res, 200, true, "Global products fetched successfully from database", responseData);

  } catch (error) {
    console.error("Get Global Products Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};