import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        name: {
          type: String,
          required: true,
          trim: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        priceAtPurchase: {
          type: Number,
          required: true,
          min: 0
        },
        totalPrice: {
          type: Number,
          required: true,
          min: 0
        }
      }
    ],
    customerInfo: {
      name: {
        type: String,
        required: true,
        trim: true
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
      },
      phone: {
        type: String,
        required: true,
        trim: true
      },
      shippingAddress: {
        type: String,
        required: true,
        trim: true
      },
      city: {
        type: String,
        required: true,
        trim: true
      }
    },
    pricingBreakdown: {
      subTotal: {
        type: Number,
        required: true,
        min: 0
      },
      shippingCharges: {
        type: Number,
        required: true,
        default: 0,
        min: 0
      },
      grandTotal: {
        type: Number,
        required: true,
        min: 0
      }
    },
    status: {
      type: String,
      enum: ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Placed'
    },
    paymentDetails: {
      method: {
        type: String,
        enum: ['COD', 'Manual Transfer'],
        required: true
      },
      status: {
        type: String,
        enum: ['Pending', 'Awaiting Verification', 'Paid', 'Rejected'],
        default: 'Pending'
      },
      paymentScreenShot: {
        type: String,
        default: ''
      },
      verificationAttempts: {
        type: Number,
        default: 0
      },
      rejectionReason: {
        type: String,
        enum: [
          'Fake/Old Screenshot',
          'Blurry/Unreadable Image',
          'Incomplete Amount'
        ],
        required: function () {
          return this.paymentDetails.status === 'Rejected';
        }
      }
    }
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', OrderSchema);
export default Order;