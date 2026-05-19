import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Store type is required'],
      enum: ['RETAIL', 'SERVICE'],
      uppercase: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    subCategory: {
      type: String,
      trim: true,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    banner: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    aiGeneratedContent: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      required: [true, 'Store phone number is required'],
      trim: true,
    },
    socialMediaLinks: {
  facebook: {
    type: String,
    trim: true,
    default: ""
  },
  instagram: {
    type: String,
    trim: true,
    default: ""
  },
  youtube: {
    type: String,
    trim: true,
    default: ""
  },
    },
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
    },
    totalViews: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Store = mongoose.model('Store', storeSchema);

export default Store;