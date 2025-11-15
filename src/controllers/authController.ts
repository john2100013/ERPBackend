import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, first_name, last_name, business_name } = req.body;

      // Validation
      if (!email || !password || !first_name || !last_name || !business_name) {
        res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
        return;
      }

      // Password validation
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
        return;
      }

      const result = await AuthService.register({
        email: email.toLowerCase().trim(),
        password,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        business_name: business_name.trim()
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: result.user,
          business: result.business,
          token: result.token
        }
      });
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      const result = await AuthService.login(email.toLowerCase().trim(), password);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          business: result.business,
          token: result.token
        }
      });
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        res.status(401).json({
          success: false,
          message: error.message
        });
        return;
      }
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const user = await AuthService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { current_password, new_password } = req.body;
      const userId = (req as any).user.id;

      // Validation
      if (!current_password || !new_password) {
        res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
        return;
      }

      if (new_password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
        return;
      }

      // Get current user
      const user = await AuthService.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password (you'll need to get the hashed password)
      // This is a simplified version - you'd need to get the password hash from DB
      // and verify it using AuthService.comparePassword

      await AuthService.updateUserPassword(userId, new_password);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    // For JWT, logout is typically handled on the client side
    // You could implement token blacklisting here if needed
    res.json({
      success: true,
      message: 'Logout successful'
    });
  }
}