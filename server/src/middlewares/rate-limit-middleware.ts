import rateLimit from "express-rate-limit";

export const GlobalLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many requests, please try again after 1 minutes 🚦",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many registration attempts, please try again after 5 minutes 🛑",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimit = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts, please try again after 2 minute ⚠️",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const logoutLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many logout attempts, please try again after 1 minute 🚪",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const deleteAccountLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many account deletion attempts, please try again after 1 minute 🚪",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const contactLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many contact requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
