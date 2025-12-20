import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './database/connection';
import routes from './routes';
import { limiter, corsOptions, securityHeaders, errorHandler, notFoundHandler } from './middleware';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production';

// Debug logger utility
const debugLog = {
  request: (method: string, url: string, headers?: any) => {
    if (DEBUG) {
      console.log(`📥 ${method} ${url}`);
      if (headers) console.log(`🔍 Headers:`, JSON.stringify(headers, null, 2));
    }
  },
  body: (body: any) => {
    if (DEBUG && body && Object.keys(body).length > 0) {
      console.log(`📝 Body:`, JSON.stringify(body, null, 2));
    }
  },
  info: (message: string) => {
    if (DEBUG) console.log(message);
  },
  error: (message: string, error?: any) => {
    console.error(message, error || '');
  }
};

// Security middleware
// IMPORTANT: CORS must be applied FIRST and BEFORE rate limiting to handle preflight OPTIONS requests
app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  debugLog.request(req.method, req.url, req.headers);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log parsed body
app.use((req, res, next) => {
  debugLog.body(req.body);
  next();
});

// Initialize database connection for serverless
if (process.env.NODE_ENV === 'production') {
  connectDB().then(() => {
    console.log('✅ Database connected successfully');
  }).catch((error) => {
    debugLog.error('❌ Database connection failed:', error);
  });
}

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ERP Backend API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      items: '/api/items',
      invoices: '/api/invoices',
      quotations: '/api/quotations',
      'business-settings': '/api/business-settings',
      'financial-accounts': '/api/financial-accounts',
      'goods-returns': '/api/goods-returns',
      'damage-records': '/api/damage-records',
      analytics: '/api/analytics'
    }
  });
});

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await connectDB();
    console.log('✅ Database connected successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 API available at http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Export the app for Vercel serverless functions
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
  });

  startServer();
}