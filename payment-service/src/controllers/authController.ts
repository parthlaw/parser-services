import { Request, Response } from 'express';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ApiResponse, JwtPayload } from '@/types';
import config from '@/config/environment';
import logger from '@/utils/logger';
import { asyncHandler, ApiError } from '@/middleware/errorHandler';

/**
 * Generate JWT token
 */
const generateToken = (payload: JwtPayload): string => {
  const secret: Secret = config.JWT_SECRET as unknown as Secret;
  const options: SignOptions = {};
  (options as any).expiresIn = config.JWT_EXPIRE_IN;
  return jwt.sign(payload, secret, options);
};

/**
 * Mock user data (replace with database integration)
 */
const mockUsers = [
  {
    id: '1',
    email: 'admin@example.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYcNdDp.HGF.a5u', // "password123"
    role: 'admin',
  },
  {
    id: '2',
    email: 'user@example.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYcNdDp.HGF.a5u', // "password123"
    role: 'user',
  },
];

/**
 * Login endpoint
 */
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ApiError('Email and password are required', 400);
  }

  // Find user (replace with database query)
  const user = mockUsers.find(u => u.email === email);
  if (!user) {
    throw new ApiError('Invalid credentials', 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError('Invalid credentials', 401);
  }

  // Generate token
  const tokenPayload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const token = generateToken(tokenPayload);

  logger.info('User logged in successfully', {
    userId: user.id,
    email: user.email,
  });

  const response: ApiResponse = {
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: config.API_VERSION,
    },
  };

  res.status(200).json(response);
});

/**
 * Register endpoint (mock implementation)
 */
export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password, role = 'user' } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ApiError('Email and password are required', 400);
  }

  if (password.length < 6) {
    throw new ApiError('Password must be at least 6 characters long', 400);
  }

  // Check if user exists (replace with database query)
  const existingUser = mockUsers.find(u => u.email === email);
  if (existingUser) {
    throw new ApiError('User already exists', 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user (replace with database insertion)
  const newUser = {
    id: String(mockUsers.length + 1),
    email,
    password: hashedPassword,
    role,
  };

  mockUsers.push(newUser);

  // Generate token
  const tokenPayload: JwtPayload = {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
  };

  const token = generateToken(tokenPayload);

  logger.info('User registered successfully', {
    userId: newUser.id,
    email: newUser.email,
  });

  const response: ApiResponse = {
    success: true,
    message: 'Registration successful',
    data: {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: config.API_VERSION,
    },
  };

  res.status(201).json(response);
});

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // User is attached by auth middleware
  const { user } = req as any;

  const response: ApiResponse = {
    success: true,
    message: 'Profile retrieved successfully',
    data: {
      user,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: config.API_VERSION,
    },
  };

  res.status(200).json(response);
});
