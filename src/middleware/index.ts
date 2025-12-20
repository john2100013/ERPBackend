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

// CORS configuration - simplified for better reliability on Vercel
export const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    try {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Define allowed origins
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://frontend-ruby-theta-36.vercel.app',
        'https://frontend-fjvj3z1ad-johns-projects-9fb711ff.vercel.app'
      ].filter(Boolean) as string[];
      
      // Check if origin is in allowed list or matches Vercel pattern
      const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/frontend-.*\.vercel\.app$/.test(origin);
      
      if (isAllowed) {
        callback(null, true);
      } else {
        // Allow any .vercel.app origin as fallback (fail open for production)
        if (origin.includes('.vercel.app')) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      }
    } catch (error) {
      // On any error, allow the request (fail open)
      console.error('CORS origin check error:', error);
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  maxAge: 86400
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