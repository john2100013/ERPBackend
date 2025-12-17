import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../database/connection';
import type { User, Business } from '../types';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(userId: number, businessId: number, role: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    const payload = { userId, businessId, role };
    
    // Using type assertion to work around TypeScript issues with jwt.sign
    return (jwt.sign as any)(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  }

  static async register(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    business_name: string;
  }): Promise<{ user: User; business: Business; token: string }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if email already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Email already registered');
      }

      // Create business
      const businessResult = await client.query(
        `INSERT INTO businesses (name, email, status) 
         VALUES ($1, $2, 'active') 
         RETURNING *`,
        [userData.business_name, userData.email]
      );

      const business = businessResult.rows[0];

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user (owner)
      const userResult = await client.query(
        `INSERT INTO users (business_id, email, first_name, last_name, password_hash, role, status) 
         VALUES ($1, $2, $3, $4, $5, 'owner', 'active') 
         RETURNING id, business_id, email, first_name, last_name, role, status, created_at, updated_at`,
        [business.id, userData.email, userData.first_name, userData.last_name, hashedPassword]
      );

      const user = userResult.rows[0];

      await client.query('COMMIT');

      // Generate token
      const token = this.generateToken(user.id, user.business_id, user.role);

      // Add is_active field to match User type
      const userWithIsActive = {
        ...user,
        is_active: user.status === 'active'
      };

      return { user: userWithIsActive, business, token };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async login(email: string, password: string): Promise<{ user: User; business: Business; token: string }> {
    // Get user with business info
    const result = await pool.query(
      `SELECT u.*, b.name as business_name, b.status as business_status
       FROM users u
       JOIN businesses b ON u.business_id = b.id
       WHERE u.email = $1 AND u.status = 'active' AND b.status = 'active'`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const userData = result.rows[0];

    // Check password
    const isValidPassword = await this.comparePassword(password, userData.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Create user and business objects
    const user: User = {
      id: userData.id,
      business_id: userData.business_id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      is_active: userData.status === 'active',
      created_at: userData.created_at,
      updated_at: userData.updated_at
    };

    const business: Business = {
      id: userData.business_id,
      name: userData.business_name,
      email: userData.email,
      phone: undefined,
      address: undefined,
      website: undefined,
      logo_url: undefined,
      tax_number: undefined,
      created_at: userData.created_at,
      updated_at: userData.updated_at
    };

    // Generate token
    const token = this.generateToken(user.id, user.business_id, user.role);

    return { user, business, token };
  }

  static async getUserById(userId: number): Promise<User | null> {
    const result = await pool.query(
      `SELECT id, business_id, email, first_name, last_name, role, status, created_at, updated_at
       FROM users 
       WHERE id = $1 AND status = 'active'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const userData = result.rows[0];
    return {
      id: userData.id,
      business_id: userData.business_id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      is_active: userData.status === 'active',
      created_at: userData.created_at,
      updated_at: userData.updated_at
    };
  }

  static async getUserByEmail(email: string): Promise<{ id: number; email: string; password_hash: string } | null> {
    const result = await pool.query(
      `SELECT id, email, password_hash
       FROM users 
       WHERE email = $1 AND status = 'active'`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  static async getUserWithPassword(userId: number): Promise<{ id: number; password_hash: string } | null> {
    const result = await pool.query(
      `SELECT id, password_hash
       FROM users 
       WHERE id = $1 AND status = 'active'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  static async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);
    
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );
  }

  // Generate a random 6-digit OTP
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Generate a random reset token
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create password reset token/OTP
  static async createPasswordResetToken(email: string): Promise<{ token: string; otp: string } | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return null; // Don't reveal if email exists
    }

    // Generate OTP and token
    const otp = this.generateOTP();
    const token = this.generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Delete any existing tokens for this user
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user.id]
    );

    // Create new token
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, otp_code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, token, otp, expiresAt]
    );

    return { token, otp };
  }

  // Verify OTP code
  static async verifyOTP(email: string, otp: string): Promise<{ valid: boolean; token?: string }> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return { valid: false };
    }

    const result = await pool.query(
      `SELECT token, expires_at, used
       FROM password_reset_tokens
       WHERE user_id = $1 AND otp_code = $2 AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, otp]
    );

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const resetToken = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);

    if (expiresAt < now) {
      return { valid: false };
    }

    return { valid: true, token: resetToken.token };
  }

  // Verify reset token
  static async verifyResetToken(token: string): Promise<{ valid: boolean; userId?: number }> {
    const result = await pool.query(
      `SELECT user_id, expires_at, used
       FROM password_reset_tokens
       WHERE token = $1 AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [token]
    );

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const resetToken = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);

    if (expiresAt < now) {
      return { valid: false };
    }

    return { valid: true, userId: resetToken.user_id };
  }

  // Reset password using token
  static async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    const verification = await this.verifyResetToken(token);
    if (!verification.valid || !verification.userId) {
      return false;
    }

    // Update password
    await this.updateUserPassword(verification.userId, newPassword);

    // Mark token as used
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1',
      [token]
    );

    return true;
  }

  // Reset password using OTP
  static async resetPasswordWithOTP(email: string, otp: string, newPassword: string): Promise<boolean> {
    const verification = await this.verifyOTP(email, otp);
    if (!verification.valid || !verification.token) {
      return false;
    }

    // Update password using the token
    const success = await this.resetPasswordWithToken(verification.token, newPassword);
    return success;
  }
}