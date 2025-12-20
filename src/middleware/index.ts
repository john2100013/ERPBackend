import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';

// Rate limiting - skip OPTIONS requests (CORS preflight)
export const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  skip: (req) => req.method === 'OPTIONS' // Skip rate limiting for CORS preflight requests
});

// CORS configuration
export const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // In development, allow all localhost origins
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    console.log(`🔍 CORS Debug - Incoming origin: ${origin}`);
    console.log(`🔍 CORS Debug - FRONTEND_URL env: ${process.env.FRONTEND_URL}`);
    console.log(`🔍 CORS Debug - NODE_ENV: ${process.env.NODE_ENV}`);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // In development, allow all localhost and 127.0.0.1 origins
    if (isDevelopment && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      console.log(`✅ CORS: Allowing localhost origin in development: ${origin}`);
      return callback(null, true);
    }
    
    // Define allowed origins (strings only, normalize for comparison)
    const allowedOriginsList = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://frontend-ruby-theta-36.vercel.app', // Current production frontend
      'https://frontend-fjvj3z1ad-johns-projects-9fb711ff.vercel.app' // Old/backup frontend
    ].filter(Boolean) as string[]; // Remove any undefined/null values
    
    // Normalize origin for comparison (remove trailing slashes)
    const normalizedOrigin = origin?.replace(/\/$/, '');
    
    console.log(`🔍 CORS Debug - Allowed origins:`, allowedOriginsList);
    console.log(`🔍 CORS Debug - Normalized origin:`, normalizedOrigin);
    
    // Check if origin matches any allowed origin (normalized comparison)
    const isAllowed = allowedOriginsList.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '');
      return normalizedAllowed === normalizedOrigin || allowed === normalizedOrigin;
    });
    
    // Also check if it matches Vercel preview URL pattern
    const isVercelPreview = /^https:\/\/frontend-.*\.vercel\.app$/.test(origin || '');
    
    if (isAllowed || isVercelPreview) {
      console.log(`✅ CORS: Origin ${origin} is allowed`);
      callback(null, true);
    } else {
      console.error(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "http://localhost:3001", "http://localhost:5173"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Error handling middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('🚨 Error Handler Triggered:', error);
  console.error('🚨 Error Stack:', error.stack);
  console.error('🚨 Request URL:', req.url);
  console.error('🚨 Request Method:', req.method);

  // Default error
  let status = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (error.code === '23505') { // PostgreSQL unique violation
    status = 400;
    message = 'Resource already exists';
  } else if (error.code === '23503') { // PostgreSQL foreign key violation
    status = 400;
    message = 'Referenced resource does not exist';
  } else if (error.name === 'ValidationError') {
    status = 400;
    message = error.message;
  } else if (error.status) {
    status = error.status;
    message = error.message;
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
};