import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import type { Algorithm } from "jsonwebtoken";
import logger from "../utils/logger";
import envConfig from "@/config/environment";
const JWT_SECRET = envConfig.JWT_SECRET;
const JWT_ALGORITHM = envConfig.JWT_ALGORITHM as Algorithm;

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { id?: string; uid?: string, email?: string, name?: string };
    }
  }
}

export function withJwtAuth(req: Request, res: Response, next: NextFunction): void | Response {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as JwtPayload;
    // Attach user info to request
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: err.name === "TokenExpiredError" ? "Token expired" : "Invalid token"
    });
  }
}

export function withJwtAuthNoAuth(req: Request, _res: Response, next: NextFunction): void {
  /*
  This middleware does not return error if the token is invalid or expired
  */
  const requestId = req.get('x-request-id') || 'unknown';
  logger.defaultMeta = { ...logger.defaultMeta, request_id: requestId };
  
  const authHeader = req.headers.authorization;
  logger.debug('Auth header check', { has_auth_header: !!authHeader });
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.debug('No valid auth header, proceeding without authentication');
    return next();
  }
  
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as JwtPayload;
    // Attach user info to request with explicit type casting
    req.user = {
      ...decoded,
      id: decoded.sub || undefined,
      uid: decoded.sub || undefined
    } as JwtPayload & { id?: string; uid?: string };
    logger.debug('User authenticated successfully', { user_id: decoded.sub });
    next();
  } catch (err: any) {
    logger.debug('Token validation failed, proceeding without authentication', err);
    next();
  }
}
