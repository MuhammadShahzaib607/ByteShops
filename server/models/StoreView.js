import mongoose from 'mongoose';

const storeViewSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

storeViewSchema.index({ storeId: 1, userId: 1 }, { unique: true });

const StoreView = mongoose.model('StoreView', storeViewSchema);

export default StoreView;