import { Router } from "express";
import { body } from "express-validator";
import {
  signup,
  login,
  getMe,
  logout,
  deleteAccount,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerification,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  deleteAccountLimit,
  GlobalLimit,
  loginLimit,
  logoutLimit,
  registerLimit,
} from "../middlewares/rate-limit-middleware.js";
import ValidateData from "../middlewares/validate.middleware.js";

const router = Router();

// Validation rules for user registration
export const signupValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required.")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters long."),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isLength({ min: 10 })
    .withMessage("Password must be at least 10 characters long."),
  ValidateData,
];

// Validation rules for user login
export const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required."),
  ValidateData,
];

router.post("/signup", registerLimit, signupValidation, signup);
router.post("/login", loginLimit, loginValidation, login);
router.post("/verify-email", loginLimit, body("token").isLength({ min: 32 }), ValidateData, verifyEmail);
router.post("/resend-verification", loginLimit, body("email").isEmail().normalizeEmail(), ValidateData, resendVerification);
router.post("/forgot-password", loginLimit, body("email").isEmail().normalizeEmail(), ValidateData, forgotPassword);
router.post(
  "/reset-password",
  loginLimit,
  body("token").isLength({ min: 32 }),
  body("password").isLength({ min: 10 }),
  ValidateData,
  resetPassword,
);
router.get("/me", GlobalLimit, authenticate, getMe);
router.post("/logout", logoutLimit, logout);
router.delete("/account", deleteAccountLimit, authenticate, deleteAccount);

export default router;
