import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";
import Service from "../models/Service.js"
import { sendRes } from "../utils/responseHandler.js"

export const createAppointment = async (req, res) => {
  try {
    const {
      storeId,
      serviceId,
      ownerId,
      customerId,
      customerInfo,
      notes,
      timeslot,
      day,
      appointmentDate
    } = req.body || {};

    if (!storeId || !serviceId || !ownerId || !customerId || !customerInfo || !timeslot || !day || !appointmentDate) {
      return sendRes(res, 400, false, "All core fields are required");
    }

    const { name, email, phone } = customerInfo;
    if (!name || !email || !phone) {
      return sendRes(res, 400, false, "All customer info fields (name, email, phone) are required");
    }

    const service = await Service.findOne({ _id: serviceId, storeId, isActive: true });
    if (!service) {
      return sendRes(res, 404, false, "Service not found or inactive in this store");
    }

    const isDayAvailable = service.availableDays.some(
      d => d.trim().toLowerCase() === day.trim().toLowerCase()
    );
    const isSlotAvailable = service.timeSlots.some(
      s => s.trim().toLowerCase() === timeslot.trim().toLowerCase()
    );

    if (!isDayAvailable || !isSlotAvailable) {
      return sendRes(res, 400, false, "The selected day or timeslot is not offered by this service");
    }

    const existingBooking = await Appointment.findOne({
      storeId,
      serviceId,
      "serviceDetails.appointmentDate": appointmentDate.trim(),
      "serviceDetails.timeslot": timeslot.trim(),
      status: { $ne: 'Cancelled' }
    });

    if (existingBooking) {
      return sendRes(res, 400, false, "This timeslot is already booked for the selected date");
    }

    const customerOverlap = await Appointment.findOne({
      customerId,
      "serviceDetails.appointmentDate": appointmentDate.trim(),
      "serviceDetails.timeslot": timeslot.trim(),
      status: { $ne: 'Cancelled' }
    });

    if (customerOverlap) {
      return sendRes(res, 400, false, "You already have another appointment booked at this exact time");
    }

    const activePrice = service.discountedPrice > 0 ? service.discountedPrice : service.price;

    const newAppointment = new Appointment({
      storeId,
      serviceId,
      ownerId,
      customerId,
      customerInfo: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim()
      },
      status: 'Pending',
      notes: notes ? notes.trim() : '',
      serviceDetails: {
        name: service.name,
        price: activePrice,
        duration: service.duration,
        timeslot: timeslot.trim(),
        day: day.trim(),
        appointmentDate: appointmentDate.trim()
      },
      paymentStatus: 'Pending',
      isCompleted: false
    });

    const savedAppointment = await newAppointment.save();

    const newNotification = new Notification({
      recipientId: ownerId,
      refrenceId: savedAppointment._id,
      title: "New Booking Received!",
      type: "Appointment",
      message: `${customerInfo.name} has reserved a slot for ${service.name} on ${appointmentDate} at ${timeslot}. (Pay at Counter)`,
    })

    newNotification.save();

    return sendRes(res, 201, true, "Appointment booked successfully", newAppointment);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getStoreAppointments = async (req, res) => {
  try {
    const storeId = req.store._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required");
    }

    const [
      appointments,
      totalCount,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount
    ] = await Promise.all([
      Appointment.find({ storeId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments({ storeId }),
      Appointment.countDocuments({ storeId, status: 'Pending' }),
      Appointment.countDocuments({ storeId, status: 'Confirmed' }),
      Appointment.countDocuments({ storeId, status: 'Completed' }),
      Appointment.countDocuments({ storeId, status: 'Cancelled' })
    ]);

    const hasMore = skip + appointments.length < totalCount;

    const responseData = {
      appointments,
      meta: {
        currentPage: page,
        limit,
        hasMore,
        stats: {
          total: totalCount,
          pending: pendingCount,
          confirmed: confirmedCount,
          completed: completedCount,
          cancelled: cancelledCount
        }
      }
    };

    return sendRes(res, 200, true, "Store appointments and stats fetched successfully", responseData);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getCustomerAppointments = async (req, res) => {
  try {
    const customerId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!customerId) {
      return sendRes(res, 400, false, "Customer identity missing from request");
    }

    const [appointments, totalAppointments] = await Promise.all([
      Appointment.find({ customerId })
        .populate({
          path: 'storeId',
          select: 'name logo'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments({ customerId })
    ]);

    const hasMore = skip + appointments.length < totalAppointments;

    const responseData = {
      appointments,
      meta: {
        totalAppointments,
        currentPage: page,
        limit,
        hasMore
      }
    };

    return sendRes(res, 200, true, "Customer appointments fetched successfully", responseData);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getSingleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const reqUserId = req.user.userId;

    if (!appointmentId) {
      return sendRes(res, 400, false, "Appointment ID is required");
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate({
        path: 'storeId',
        select: 'name logo'
      })
      .populate({
        path: 'customerId',
        select: 'name profilePic'
      })
      .populate({
        path: 'ownerId',
        select: 'name profilePic'
      });

    if (!appointment) {
      return sendRes(res, 404, false, "Appointment not found");
    }

    const isCustomer = appointment.customerId._id.toString() === reqUserId.toString();
    const isStoreOwner = appointment.ownerId.toString() === reqUserId.toString();

    if (!isCustomer && !isStoreOwner) {
      return sendRes(res, 403, false, "Unauthorized: You do not have permission to view this appointment");
    }

    return sendRes(res, 200, true, "Appointment details fetched successfully", appointment);

  } catch (error) {
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const reqUserId = req.user.userId;

    if (!appointmentId || !status) {
      return sendRes(res, 400, false, "Appointment ID and status are required");
    }

    const validStatuses = ['Confirmed', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return sendRes(res, 400, false, "Invalid status state. Only Confirmed, Completed, or Cancelled are allowed.");
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return sendRes(res, 404, false, "Appointment not found");
    }

    const isCustomer = appointment.customerId.toString() === reqUserId.toString();
    const isStoreOwner = appointment.ownerId.toString() === reqUserId.toString();

    if (!isCustomer && !isStoreOwner) {
      return sendRes(res, 403, false, "Unauthorized access: Unknown identity");
    }

    if (isCustomer) {
      if (status !== 'Cancelled') {
        return sendRes(res, 400, false, "Customers are only allowed to cancel their appointments");
      }
      if (appointment.status !== 'Pending') {
        return sendRes(res, 400, false, `Appointment cannot be cancelled because it is already ${appointment.status}`);
      }
    }

    if (isStoreOwner) {
      if (status === 'Completed' && appointment.status !== 'Confirmed') {
        return sendRes(res, 400, false, "An appointment can only be marked as Completed if it was previously Confirmed");
      }
    }

    // Status aur flag update
    appointment.status = status;
    if (status === 'Completed') {
      appointment.isCompleted = true;
    }

    await appointment.save();

    // 🔔 Notification Logic Setup
    let recipientId;
    let title = "";
    let message = "";

    if (isCustomer) {
      recipientId = appointment.ownerId;
      title = "Appointment Cancelled by Customer";
      message = `Customer ${appointment.customerInfo.name} has cancelled the appointment for ${appointment.serviceDetails.name} scheduled on ${appointment.serviceDetails.appointmentDate} (${appointment.serviceDetails.timeslot}).`;
    } else if (isStoreOwner) {
      recipientId = appointment.customerId;

      if (status === 'Confirmed') {
        title = "Appointment Confirmed!";
        message = `Your appointment for ${appointment.serviceDetails.name} on ${appointment.serviceDetails.appointmentDate} at ${appointment.serviceDetails.timeslot} has been confirmed by the store.`;
      } else if (status === 'Completed') {
        title = "Appointment Completed";
        message = `Thank you! Your appointment for ${appointment.serviceDetails.name} has been marked as completed. We hope you had a great experience.`;
      } else if (status === 'Cancelled') {
        title = "Appointment Cancelled by Store";
        message = `Regrettably, your appointment for ${appointment.serviceDetails.name} on ${appointment.serviceDetails.appointmentDate} has been cancelled by the store owner.`;
      }
    }

    if (recipientId) {
      await Notification.create({
        recipientId,
        refrenceId: appointmentId,
        title,
        message,
        isRead: false,
        type: "appointment"
      });
    }

    return sendRes(res, 200, true, `Appointment status updated to ${status} successfully`, appointment);

  } catch (error) {
    console.error("Update Appointment Status Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const updateAppointmentPaymentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { paymentStatus } = req.body;
    const reqUserId = req.user.userId;

    if (!appointmentId || !paymentStatus) {
      return sendRes(res, 400, false, "Appointment ID and payment status are required");
    }

    if (paymentStatus !== 'Paid') {
      return sendRes(res, 400, false, "Invalid payment status. Only 'Paid' status update is allowed through this API.");
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return sendRes(res, 404, false, "Appointment not found");
    }

    const isStoreOwner = appointment.ownerId.toString() === reqUserId.toString();
    if (!isStoreOwner) {
      return sendRes(res, 403, false, "Unauthorized: Only the store owner can update the payment status");
    }

    if (appointment.paymentStatus === 'Paid') {
      return sendRes(res, 400, false, "This appointment payment is already marked as Paid");
    }

    appointment.paymentStatus = 'Paid';
    await appointment.save();

    const notificationTitle = "Payment Confirmed!";
    const notificationMessage = `Your payment for the service "${appointment.serviceDetails.name}" scheduled on ${appointment.serviceDetails.appointmentDate} has been successfully verified and marked as Paid.`;

    await Notification.create({
      recipientId: appointment.customerId,
      refrenceId: appointmentId,
      title: notificationTitle,
      message: notificationMessage,
      isRead: false,
      type: "appointment"
    });

    return sendRes(res, 200, true, "Payment status updated to Paid and customer notified successfully", appointment);

  } catch (error) {
    console.error("Update Appointment Payment Status Error:", error);
    return sendRes(res, 500, false, "Internal server error: " + error.message);
  }
};

export const getBookedSlots = async (req, res) => {
  try {
    const { serviceId, date } = req.query
    if (!serviceId || !date) {
     return sendRes(res, 400, false, "serviceId and date are reuired")
    }
    const [appointments, totalCount] = await Promise.all([
      Appointment.find({
        serviceId,
        "serviceDetails.appointmentDate": date,
        status: { $in: ["Pending", "Confirmed"] }
      }),
      Appointment.countDocuments({
        serviceId,
        "serviceDetails.appointmentDate": date,
        status: { $in: ["Pending", "Confirmed"] }
      })
    ])
    const data = {
      appointments,
      totalAppointments: totalCount
    }
    sendRes(res, 200, true, "bookedSlots", data)
  } catch (error) {
    console.log(error.message)
  }
}