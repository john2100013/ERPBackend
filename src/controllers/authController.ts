import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { EmailService } from '../services/emailService';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('🚀 Registration attempt started');
      console.log('🔍 Request body:', JSON.stringify(req.body, null, 2));
      console.log('🔍 Request headers:', JSON.stringify(req.headers, null, 2));
      
      const { email, password, first_name, last_name, business_name } = req.body;

      console.log('🔍 Extracted fields:', { 
        email, 
        password: password ? '[HIDDEN]' : 'undefined', 
        first_name, 
        last_name, 
        business_name 
      });

      // Validation
      if (!email || !password || !first_name || !last_name || !business_name) {
        console.log('❌ Validation failed - missing required fields');
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

      console.log('✅ Validation passed, calling AuthService.register');
      
      const result = await AuthService.register({
        email: email.toLowerCase().trim(),
        password,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        business_name: business_name.trim()
      });

      console.log('✅ AuthService.register completed successfully');
      console.log('🔍 Result:', { 
        user: result.user ? 'User object present' : 'No user', 
        business: result.business ? 'Business object present' : 'No business',
        token: result.token ? 'Token present' : 'No token'
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
      console.error('❌ Registration error:', error);
      console.error('❌ Error stack:', error.stack);
      
      if (error.message === 'Email already registered') {
        console.log('📧 Email already registered error');
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }
      
      console.log('🔄 Passing error to next middleware');
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      console.log('🔐 [AuthController.login] Login request received for:', email);

      // Validation
      if (!email || !password) {
        console.log('❌ [AuthController.login] Missing email or password');
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      const result = await AuthService.login(email.toLowerCase().trim(), password);

      console.log('✅ [AuthController.login] Login successful, returning user data:', {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        permissions: {
          can_access_analytics: result.user.can_access_analytics,
          can_access_invoices: result.user.can_access_invoices,
          can_access_business_settings: result.user.can_access_business_settings,
          can_access_financial_accounts: result.user.can_access_financial_accounts
        }
      });

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
      console.error('❌ [AuthController.login] Login error:', error.message);
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
      console.log('🔐 [AuthController.getProfile] Fetching profile for userId:', userId);
      
      const user = await AuthService.getUserById(userId);

      if (!user) {
        console.log('❌ [AuthController.getProfile] User not found');
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      console.log('✅ [AuthController.getProfile] Profile fetched:', {
        userId: user.id,
        permissions: {
          can_access_analytics: user.can_access_analytics ?? false,
          can_access_invoices: user.can_access_invoices ?? false,
          can_access_business_settings: user.can_access_business_settings ?? false,
          can_access_financial_accounts: user.can_access_financial_accounts ?? false
        }
      });

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('❌ [AuthController.getProfile] Error:', error);
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

      // Get user with password hash
      const userWithPassword = await AuthService.getUserWithPassword(userId);
      if (!userWithPassword) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password
      const isValidPassword = await AuthService.comparePassword(
        current_password,
        userWithPassword.password_hash
      );

      if (!isValidPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Update password
      await AuthService.updateUserPassword(userId, new_password);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Request password reset (send OTP to email)
  static async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      // Create reset token and OTP
      const result = await AuthService.createPasswordResetToken(email);

      // Don't reveal if email exists - always return success
      if (result) {
        // Send OTP via email
        try {
          await EmailService.sendOTPEmail(email, result.otp);
          console.log(`✅ Password reset OTP sent to ${email}`);
        } catch (emailError: any) {
          console.error('⚠️  Failed to send OTP email:', emailError.message);
          // In development, still return OTP in response if email fails
          if (process.env.NODE_ENV === 'development') {
            console.log(`📧 Development Mode - OTP for ${email}: ${result.otp}`);
            res.json({
              success: true,
              message: 'If an account with that email exists, a password reset code has been sent.',
              // Only in development - remove in production
              data: {
                otp: result.otp,
                token: result.token,
                note: 'Email sending failed, OTP shown for development only'
              }
            });
            return;
          }
          // In production, don't reveal if email sending failed
        }
        
        // Success response (don't include OTP in production)
        res.json({
          success: true,
          message: 'If an account with that email exists, a password reset code has been sent.'
        });
      } else {
        // Still return success to prevent email enumeration
        res.json({
          success: true,
          message: 'If an account with that email exists, a password reset code has been sent.'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // Verify OTP
  static async verifyPasswordResetOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
        return;
      }

      const verification = await AuthService.verifyOTP(email, otp);

      if (!verification.valid) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP code'
        });
        return;
      }

      res.json({
        success: true,
        message: 'OTP verified successfully',
        data: {
          token: verification.token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Reset password with OTP
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, new_password, token } = req.body;

      if (!new_password) {
        res.status(400).json({
          success: false,
          message: 'New password is required'
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

      let success = false;

      // Try reset with OTP if provided
      if (email && otp) {
        success = await AuthService.resetPasswordWithOTP(email, otp, new_password);
      } 
      // Try reset with token if provided
      else if (token) {
        success = await AuthService.resetPasswordWithToken(token, new_password);
      } else {
        res.status(400).json({
          success: false,
          message: 'Either OTP code or reset token is required'
        });
        return;
      }

      if (!success) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset code/token'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
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