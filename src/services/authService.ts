import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
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

  static async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);
    
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );
  }
}