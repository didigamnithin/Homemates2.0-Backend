import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    builderId: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Allow all requests - no authentication required
  // Set a default user for compatibility
  req.user = {
    id: 'guest',
    email: 'guest@homemates.com',
    builderId: 'guest'
    };
    next();
};

