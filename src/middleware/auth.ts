import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  businessId?: number;
  userId?: number;
  role?: string;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Token payload structure: { userId, businessId, role }
    req.user = {
      id: decoded.userId,
      business_id: decoded.businessId,
      role: decoded.role
    } as User;
    req.businessId = decoded.businessId;
    req.userId = decoded.userId; // Also set userId for convenience
    
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
      return;
    }
    next();
  };
};