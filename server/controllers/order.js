import Notification from '../models/Notification.js';
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

    const savedOrder = await newOrder.save();

    const newNotification = new Notification({
      recipientId: ownerId,
      orderId: savedOrder._id,
      title: "New Order Received",
      message: `Order has been successfully placed by ${customerInfo.name.trim()}. Total order value is Rs. ${grandTotal}. Please review the payment details in your dashboard to proceed with verification.`,
      type: "Order_Update",
      isRead: false
    })

    await newNotification.save();

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
    var isCancelledByCustomer = false

    if (!orderId || !status) {
      return sendRes(res, 400, false, "Order ID and status are required");
    }

    const validStatuses = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return sendRes(res, 400, false, "Invalid status state provided");
    }

    const order =
      await Order.findById(orderId).populate("storeId", "storeName");
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
        isCancelledByCustomer = true
        return sendRes(res, 400, false, "Customers are only allowed to cancel their orders");
      }
      if (order.status !== 'Placed') {
        return sendRes(res, 400, false, `Order cannot be cancelled because it is already ${order.status}`);
      }
    }

    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      for (const item of order.products) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });
      }
    }

    order.status = status;
    await order.save();

    if (!isCancelledByCustomer) {
      const newNotification = new Notification({
        recipientId: order.customerId,
        orderId: order._id,
        title: "Order Status Updated",
        message: `Your order from ${order?.storeId?.storeName} has been updated to "${status}". You can track the progress and details of your shipment directly from your customer dashboard.`,
        type: "Order_Update",
        isRead: false
      })

      await newNotification.save()
    }

    return sendRes(res, 200, true, `Order status updated to ${status} successfully`, order);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!orderId || !status) {
      return sendRes(res, 400, false, "Order ID and status are required");
    }

    const validPaymentStatuses = ['Paid', 'Rejected'];
    if (!validPaymentStatuses.includes(status)) {
      return sendRes(res, 400, false, "Invalid payment status. Only 'Paid' or 'Rejected' allowed.");
    }

    const order = await Order.findById(orderId).populate("storeId", "storeName");
    if (!order) {
      return sendRes(res, 404, false, "Order not found");
    }

    if (order.paymentDetails.status === 'Paid') {
      return sendRes(res, 400, false, "This order is already marked as Paid");
    }

    if (order.paymentDetails.verificationAttempts >= 3) {
      return sendRes(res, 400, false, "Verification limit reached (3 or more attempts). Action blocked.");
    }

    if (status === 'Paid') {
      order.paymentDetails.status = 'Paid';
      order.status = 'Processing';
      order.paymentDetails.rejectionReason = undefined;
    }

    else if (status === 'Rejected') {
      if (!rejectionReason) {
        return sendRes(res, 400, false, "Rejection reason is required when status is Rejected");
      }

      const validReasons = ['Fake/Old Screenshot', 'Blurry/Unreadable Image', 'Incomplete Amount'];
      if (!validReasons.includes(rejectionReason)) {
        return sendRes(res, 400, false, "Invalid rejection reason provided");
      }

      order.paymentDetails.verificationAttempts += 1;
      order.paymentDetails.status = 'Rejected';
      order.paymentDetails.rejectionReason = rejectionReason;

      if (order.paymentDetails.verificationAttempts >= 3) {
        order.status = 'Cancelled';

        const rollbackPromises = order.products.map(item => {
          return Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          });
        });
        await Promise.all(rollbackPromises);
      }
    }

    await order.save();

    const storeName = order?.storeId?.storeName || "the store";

    const remainingAttempts = 3 - order.paymentDetails.verificationAttempts;

    const notificationMessage =
      status === "Paid"
        ? `Your payment has been successfully verified by ${storeName}. Your order status is now processing.`
        : status === "Rejected"
          ? `Your payment screenshot was rejected by ${storeName}. Reason: ${rejectionReason || "Invalid receipt"}. Warning: You have ${remainingAttempts} verification attempts remaining before your order is automatically cancelled.`
          : `Your payment status has been updated to ${status}.`;

    const newNotification = new Notification({
      recipientId: order.customerId,
      orderId: order._id,
      title: status === "Paid" ? "Payment Approved" : "Payment Action Required",
      message: notificationMessage,
      type: "Payment_Alert",
      isRead: false
    });

    await newNotification.save();

    return sendRes(res, 200, true, `Payment status updated to ${status} successfully`, order);

  } catch (error) {
    console.error("Update Payment Status Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const uploadPaymentScreenshot = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentScreenShot } = req.body;
    const reqUserId = req.user.userId;

    if (!orderId || !paymentScreenShot || paymentScreenShot.trim() === "") {
      return sendRes(res, 400, false, "Order ID and payment screenshot string are required");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return sendRes(res, 404, false, "Order not found");
    }

    const isCustomer = order.customerId.toString() === reqUserId.toString();
    if (!isCustomer) {
      return sendRes(res, 403, false, "Unauthorized: You can only upload screenshots for your own orders");
    }

    if (order.paymentDetails.status === 'Paid') {
      return sendRes(res, 400, false, "This order is already marked as Paid. Cannot upload new screenshot.");
    }

    if (order.paymentDetails.verificationAttempts >= 3) {
      return sendRes(res, 400, false, "Your verification attempts limit (3) has been reached. Action blocked.");
    }

    order.paymentDetails.paymentScreenShot = paymentScreenShot.trim();
    order.paymentDetails.status = 'Awaiting Verification';

    await order.save();

    const newNotification = new Notification({
      recipientId: order.ownerId,
      orderId: order._id,
      title: "Payment Receipt Uploaded",
      message: `Customer ${order.customerInfo?.name || "A user"} has uploaded a payment screenshot. Please review the attached receipt in your dashboard to approve or reject the payment.`,
      type: "Payment_Alert",
      isRead: false
    });

    await newNotification.save()

    return sendRes(res, 200, true, "Payment screenshot uploaded successfully. Awaiting verification.", order);

  } catch (error) {
    console.error("Upload Payment Screenshot Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};