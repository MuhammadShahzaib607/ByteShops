import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
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
      }
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
      default: 'Pending'
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    serviceDetails: {
      name: {
        type: String,
        required: true,
        trim: true
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      duration: {
        type: String,
        required: true,
        trim: true
      },
      timeslot: {
        type: String,
        required: true,
        trim: true
      },
      day: {
        type: String,
        required: true,
        trim: true
      },
      appointmentDate: {
        type: String,
        required: true,
        trim: true
      }
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid'],
      default: 'Pending'
    }
  },
  { timestamps: true }
);

export default mongoose.model('Appointment', AppointmentSchema);
