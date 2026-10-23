import { validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const ValidateData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorList = errors.array();
      return res.status(400).json({
        success: false,
        message: errorList[0]?.msg || "Validation error.",
        errors: errorList,
      });
    }
    return next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error during validation.",
    });
  }
};

export default ValidateData;
