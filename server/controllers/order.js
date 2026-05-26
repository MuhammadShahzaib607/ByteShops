import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import { sendRes } from '../utils/responseHandler.js';

export const createOrder = async (req, res) => {
  try {
    const {
      storeId,
      ownerId,
      paymentMethod,
      productsArray,
      customerInfo,
      paymentScreenShot
    } = req.body || {};
    const customerId = req.user.userId;

    if (!storeId || !ownerId || !customerId || !paymentMethod || !productsArray || !customerInfo) {
      return sendRes(res, 400, false, "All fields are required");
    }

    const { name, email, phone, shippingAddress, city } = customerInfo;
    if (!name || !email || !phone || !shippingAddress || !city) {
      return sendRes(res, 400, false, "All customer info fields are required");
    }

    if (!Array.isArray(productsArray) || productsArray.length === 0) {
      return sendRes(res, 400, false, "Products array cannot be empty");
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return sendRes(res, 404, false, "Store not found");
    }

    let calculatedSubTotal = 0;
    const finalProductsList = [];

    for (const item of productsArray) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity < 1) {
        return sendRes(res, 400, false, "Valid Product ID and quantity are required");
      }

      const product = await Product.findOne({ _id: productId, storeId, isActive: true });
      if (!product) {
        return sendRes(res, 404, false, `Product with ID ${productId} not found or inactive in this store`);
      }

      if (product.stock < quantity) {
        return sendRes(res, 400, false, `Insufficient stock for product: ${product.name}. Available: ${product.stock}`);
      }

      const activePrice = product.discountedPrice > 0 ? product.discountedPrice : product.price;
      const itemTotalPrice = activePrice * quantity;

      calculatedSubTotal += itemTotalPrice;

      finalProductsList.push({
        productId: product._id,
        name: product.name,
        quantity,
        priceAtPurchase: activePrice,
        totalPrice: itemTotalPrice
      });
    }

    const customerCitySafe = city.trim().toLowerCase();
    const storeCitySafe = store.city ? store.city.trim().toLowerCase() : '';
    const shippingCharges = customerCitySafe === storeCitySafe ? 150 : 250;

    const grandTotal = calculatedSubTotal + shippingCharges;

    for (const item of finalProductsList) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    const newOrder = new Order({
      storeId,
      ownerId,
      customerId,
      products: finalProductsList,
      customerInfo: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        shippingAddress: shippingAddress.trim(),
        city: city.trim()
      },
      pricingBreakdown: {
        subTotal: calculatedSubTotal,
        shippingCharges,
        grandTotal
      },
      paymentDetails: {
        method: paymentMethod,
        status: paymentMethod === 'COD' ? 'Pending' : 'Awaiting Verification',
        paymentScreenShot: paymentScreenShot || ""
      }
    });

    const savedOrder = new Order(newOrder);
    await savedOrder.save();

    return sendRes(res, 201, true, "Order created successfully", savedOrder);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getCustomerOrders = async (req, res) => {
  try {
    const customerId = req.user.userId
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!customerId) {
      return sendRes(res, 400, false, "Customer ID is required");
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find({ customerId })
        .populate({
          path: 'storeId',
          select: 'storeName logo'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ customerId })
    ]);

    const hasMore = skip + orders.length < totalOrders;

    const responseData = {
      orders,
      meta: {
        totalOrders,
        currentPage: page,
        limit,
        hasMore
      }
    };

    return sendRes(res, 200, true, "Customer orders fetched successfully", responseData);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getStoreOrders = async (req, res) => {
  try {
    const storeId = req.store._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required");
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find({ storeId })
        .populate({
          path: 'customerId',
          select: 'name email phone'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ storeId })
    ]);

    const hasMore = skip + orders.length < totalOrders;

    const responseData = {
      orders,
      meta: {
        totalOrders,
        currentPage: page,
        limit,
        hasMore
      }
    };

    return sendRes(res, 200, true, "Store orders fetched successfully", responseData);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getStoreStats = async (req, res) => {
  try {
    const storeId = req.store._id;

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required");
    }

    const [
      placedCount,
      processingCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      pendingPaymentCount,
      awaitingPaymentCount,
      paidPaymentCount,
      rejectedPaymentCount
    ] = await Promise.all([
      Order.countDocuments({ storeId, status: 'Placed' }),
      Order.countDocuments({ storeId, status: 'Processing' }),
      Order.countDocuments({ storeId, status: 'Shipped' }),
      Order.countDocuments({ storeId, status: 'Delivered' }),
      Order.countDocuments({ storeId, status: 'Cancelled' }),
      Order.countDocuments({ storeId, 'paymentDetails.status': 'Pending' }),
      Order.countDocuments({ storeId, 'paymentDetails.status': 'Awaiting Verification' }),
      Order.countDocuments({ storeId, 'paymentDetails.status': 'Paid' }),
      Order.countDocuments({ storeId, 'paymentDetails.status': 'Rejected' })
    ]);

    const responseData = {
      orderStatuses: {
        Placed: placedCount,
        Processing: processingCount,
        Shipped: shippedCount,
        Delivered: deliveredCount,
        Cancelled: cancelledCount
      },
      paymentStatuses: {
        Pending: pendingPaymentCount,
        "Awaiting Verification": awaitingPaymentCount,
        Paid: paidPaymentCount,
        Rejected: rejectedPaymentCount
      }
    };

    return sendRes(res, 200, true, "Store statistics fetched successfully", responseData);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getSingleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const reqUserId = req.user.userId;

    if (!orderId) {
      return sendRes(res, 400, false, "Order ID is required");
    }

    const order = await Order.findById(orderId)
      .populate({
        path: 'storeId',
        select: 'name logo city'
      })
      .populate({
        path: 'customerId',
        select: 'name email phone'
      });

    if (!order) {
      return sendRes(res, 404, false, "Order not found");
    }

    const isCustomer = order.customerId._id.toString() === reqUserId.toString();
    const isStoreOwner = order.ownerId.toString() === reqUserId.toString();

    if (!isCustomer && !isStoreOwner) {
      return sendRes(res, 403, false, "Unauthorized: You do not have permission to view this order");
    }

    return sendRes(res, 200, true, "Order details fetched successfully", order);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const reqUserId = req.user.userId;

    if (!orderId || !status) {
      return sendRes(res, 400, false, "Order ID and status are required");
    }

    const validStatuses = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return sendRes(res, 400, false, "Invalid status state provided");
    }

    const order =
     await Order.findById(orderId);
    if (!order) {
      return sendRes(res, 404, false, "Order not found");
    }

    const isCustomer = order.customerId.toString() === reqUserId.toString();
    const isStoreOwner = order.ownerId.toString() === reqUserId.toString();

    if (!isCustomer && !isStoreOwner) {
      return sendRes(res, 403, false, "Unauthorized access: Unknown identity");
    }

    if (isCustomer) {
      if (status !== 'Cancelled') {
        return sendRes(res, 400, false, "Customers are only allowed to cancel their orders");
      }
      if (order.status !== 'Placed') {
        return sendRes(res, 400, false, `Order cannot be cancelled because it is already ${order.status}`);
      }
    }

    order.status = status;
    await order.save();

    return sendRes(res, 200, true, `Order status updated to ${status} successfully`, order);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

// payment status update api for owner
// payment screenshot upload api for customer

