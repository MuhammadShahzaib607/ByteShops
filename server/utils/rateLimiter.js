import rateLimit from "express-rate-limit";
import { sendRes } from "../utils/responseHandler.js";

const createLimiter = ({ max, windowMinutes, message }) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: max, 
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return sendRes(res, 429, false, message);
    },
  });
};

export const authLimiter = createLimiter({
//   max: 5,
  max: 100,
  windowMinutes: 15,
  message: "Too many attempts. Please try again after 15 minutes."
});

export const creationLimiter = createLimiter({
//   max: 15,
  max: 100,
  windowMinutes: 15,
  message: "Slow down! You are making too many changes. Try again in 15 minutes."
});

export const generalLimiter = createLimiter({
  max: 100,
  windowMinutes: 15,
  message: "Too many requests. Please slow down."
});