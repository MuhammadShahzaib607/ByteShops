import { sendRes } from '../utils/responseHandler.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return sendRes(res, 400, false, "All fields are required");
    }

    if (password.length < 8) {
      return sendRes(res, 400, false, "Password must be at least 8 characters long");
    }

    const sanitizedUsername = username.trim().toLowerCase();
    const sanitizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email: sanitizedEmail }, { username: sanitizedUsername }]
    });

    if (existingUser) {
      if (existingUser.email === sanitizedEmail) {
        return sendRes(res, 400, false, "Email already registered");
      }
      if (existingUser.username === sanitizedUsername) {
        return sendRes(res, 400, false, "Username already taken");
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: sanitizedUsername,
      email: sanitizedEmail,
      password: hashedPassword,
    });

    await newUser.save();

    return sendRes(res, 201, true, "User registered successfully");

  } catch (error) {
    console.error("Signup Error:", error);
    return sendRes(res, 500, false, "Internal server error");
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendRes(res, 400, false, "Email and password are required");
    }

    const sanitizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: sanitizedEmail }).select('+password');
    if (!user) {
      return sendRes(res, 404, false, "Invalid credentials");
    }

    if (!user.password) {
      return sendRes(res, 400, false, "Please continue with Google login");
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return sendRes(res, 401, false, "Invalid credentials");
    }

    if (user.isContinueWithGoogle !== false) {
      await User.findByIdAndUpdate(user._id, { $set: { isContinueWithGoogle: false } });
    }

    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } 
    );

    const userData = user.toObject();
    delete userData.password;
    userData.isContinueWithGoogle = false;

    return sendRes(res, 200, true, "Login successful", {
      user: userData,
      token: token
    });

  } catch (error) {
    console.error("Login Error:", error);
    return sendRes(res, 500, false, "Internal server error");
  }
};

export const getMe = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });

  } catch (error) {
    console.error("GET_USER_PROFILE_ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const editProfile = async (req, res) => {
  try {
    const userId = req.user.userId
    const { firstname, lastname, profilePic, phone } = req.body;

    const updateFields = {};

    if (firstname !== undefined) updateFields.firstname = firstname.trim();
    if (lastname !== undefined) updateFields.lastname = lastname.trim();
    if (profilePic !== undefined) updateFields.profilePic = profilePic;
    if (phone !== undefined) updateFields.phone = phone.trim();

    if (Object.keys(updateFields).length === 0) {
      return sendRes(res, 400, false, "No fields provided for update");
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return sendRes(res, 404, false, "User not found");
    }

    return sendRes(res, 200, true, "Profile updated successfully", updatedUser);

  } catch (error) {
    console.error("Edit Profile Error:", error);
    return sendRes(res, 500, false, "Internal server error");
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const currentAdminId = req.user.userId;

    const users = await User.find({ _id: { $ne: currentAdminId } }).select('-password');

const data = {
    totalUsers: users?.length,
    users
}

    return sendRes(res, 200, true, "Users fetched successfully", data);
  } catch (error) {
    console.error("Get All Users Error:", error);
    return sendRes(res, 500, false, "Internal server error");
  }
};

export const continueWithGoogle = async (req, res) => {
  try {
    const { email, googleId, username, profilePic } = req.body || {};

    if (!email || !googleId || !username) {
      return sendRes(res, 400, false, "Email, Google ID, and username are required");
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedUsername = username.trim().toLowerCase();

    let user = await User.findOne({ googleId });

    if (user) {
      if (user.email !== sanitizedEmail) {
        return sendRes(res, 400, false, "Google ID and email mismatch");
      }

      const token = jwt.sign(
        { userId: user._id, isAdmin: user.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const userData = user.toObject();
      delete userData.password;

      return sendRes(res, 200, true, "Login successful with Google", {
        user: userData,
        token
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: sanitizedEmail }, { username: sanitizedUsername }]
    });

    if (existingUser) {
      if (existingUser.email === sanitizedEmail) {
        return sendRes(res, 400, false, "An account with this email already exists");
      }
      if (existingUser.username === sanitizedUsername) {
        return sendRes(res, 400, false, "Username is already taken");
      }
    }

    user = new User({
      username: sanitizedUsername,
      email: sanitizedEmail,
      profilePic: profilePic || "",
      googleId,
      isContinueWithGoogle: true,
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || 'YOUR_FALLBACK_SECRET_KEY',
      { expiresIn: '7d' }
    );

    const userData = user.toObject();
    delete userData.password;

    return sendRes(res, 201, true, "Account registered successfully via Google", {
      user: userData,
      token
    });

  } catch (error) {
    console.error("Continue With Google Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};