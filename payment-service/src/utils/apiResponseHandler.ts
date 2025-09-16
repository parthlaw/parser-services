import { Response } from "express";

class ApiResponseHandler {
  static success(res: Response, data: any, message = "Success", status = 200) {
    return res.status(status).json({
      success: true,
      message,
      data,
    });
  }

  static created(res: Response, data: any, message = "Resource created") {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  static error(
    res: Response,
    error: any,
    message = "An error occurred",
    status = 500,
  ) {
    return res.status(status).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : error,
    });
  }

  static notFound(res: Response, message = "Resource not found") {
    return res.status(404).json({
      success: false,
      message,
    });
  }

  static badRequest(res: Response, message = "Bad request") {
    return res.status(400).json({
      success: false,
      message,
    });
  }

  static unauthorized(res: Response, message = "Unauthorized") {
    return res.status(401).json({
      success: false,
      message,
    });
  }

  static forbidden(res: Response, message = "Forbidden") {
    return res.status(403).json({
      success: false,
      message,
    });
  }
}

export default ApiResponseHandler;
