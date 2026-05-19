import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true, 
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: false,
      default: null
    },
    firstname: {
      type: String,
      required: false,
      trim: true,
      default: ''
    },
    lastname: {
      type: String,
      required: false,
      trim: true,
      default: ''
    },
    profilePic: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    isContinueWithGoogle: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    stores: [   
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    storesLimit: {
      type: Number,
      default: 5,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, 
  }
);

const User = mongoose.model('User', userSchema);

export default User;