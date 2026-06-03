import Notification from "../models/Notification.js";
import { sendRes } from "../utils/responseHandler.js";

export const getUserNotifications = async (req, res) => {
  try {
    const reqUserId = req.user.id || req.user.userId;

    if (!reqUserId) {
      return sendRes(res, 400, false, "User authentication failed");
    }

    const [notifications, unreadCount, totalNotifications] = await Promise.all([
      Notification.find({ recipientId: reqUserId })
        .sort({ createdAt: -1 }),
      Notification.countDocuments({ recipientId: reqUserId, isRead: false }),
      Notification.countDocuments({ recipientId: reqUserId })
    ]);

    const responseData = {
      notifications,
      unreadCount,
      totalNotifications,
    };

    return sendRes(res, 200, true, "Notifications fetched successfully", responseData);

  } catch (error) {
    console.error("Get Notifications Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const deleteNotifications = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const reqUserId = req.user.id || req.user.userId;

    if (!notificationIds || notificationIds.length === 0) {
      return sendRes(res, 400, false, "Notification IDs array is required and cannot be empty");
    }

    const deleteResult = await Notification.deleteMany({
      _id: { $in: notificationIds },
      recipientId: reqUserId 
    });

    if (deleteResult.deletedCount === 0) {
      return sendRes(res, 404, false, "No valid notifications found to delete");
    }

    return sendRes(res, 200, true, `${deleteResult.deletedCount} notifications deleted successfully`, null);

  } catch (error) {
    console.error("Delete Notifications Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const markNotificationsAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const reqUserId = req.user.id || req.user.userId;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return sendRes(res, 400, false, "Notification IDs array is required");
    }

    const updateResult = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        recipientId: reqUserId
      },
      {
        $set: { isRead: true }
      }
    );

    return sendRes(res, 200, true, `${updateResult.modifiedCount} notifications marked as read`, null);

  } catch (error) {
    console.error("Mark Read Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};