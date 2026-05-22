import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true, 
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Service description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Service price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountedPrice: {
      type: Number,
      default: 0,
      min: [0, 'Discounted price cannot be negative'],
    },
    duration: {
      type: Number,
      required: [true, 'Service duration in minutes is required'],
      min: [1, 'Duration must be at least 1 minute'],
    },
    category: {
      type: String,
      required: [true, 'Service Category is required'],
    },
    availableDays: [
      {
        type: String,
        required: [true, 'Available days are required'],
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 
      },
    ],
    timeSlots: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

serviceSchema.index({ storeId: 1, isActive: 1 });

const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

export default Service;