# CORS Error Fix Guide

## Understanding the Error

The CORS (Cross-Origin Resource Sharing) error occurs when:
- Frontend is running on `http://localhost:5173` (Vite dev server)
- Backend is running on `http://localhost:3001` (or `3000`)
- Browser blocks the request because the backend doesn't allow requests from the frontend origin

## What Was Fixed

### 1. Middleware Order (Critical Fix)
**File:** `src/app.ts`

**Problem:** Rate limiter was applied before CORS, blocking OPTIONS (preflight) requests.

**Solution:** Reordered middleware so CORS is applied FIRST:
```typescript
// OLD (WRONG):
app.use(securityHeaders);
app.use(limiter);  // ❌ Blocks OPTIONS requests
app.use(cors(corsOptions));

// NEW (CORRECT):
app.use(cors(corsOptions));  // ✅ Handles OPTIONS first
app.use(securityHeaders);
app.use(limiter);
```

### 2. Rate Limiter Configuration
**File:** `src/middleware/index.ts`

**Problem:** Rate limiter was blocking CORS preflight OPTIONS requests.

**Solution:** Added skip option for OPTIONS requests:
```typescript
export const limiter = rateLimit({
  // ... other config
  skip: (req) => req.method === 'OPTIONS' // Skip rate limiting for CORS preflight
});
```

### 3. Enhanced CORS Configuration
**File:** `src/middleware/index.ts`

**Changes:**
- In development mode, automatically allows all localhost origins
- Better logging for debugging
- Added `preflightContinue: false` for proper OPTIONS handling
- Added `maxAge` for preflight caching

## Environment Variables

### For Local Development

Create a `.env` file in the `backend` directory:

```env
# Backend Port (default: 3000)
PORT=3001

# Frontend URL (optional, defaults to http://localhost:5173)
FRONTEND_URL=http://localhost:5173

# Environment
NODE_ENV=development

# Database (your existing DB config)
DATABASE_URL=your_database_url_here
```

### For Vercel Deployment

In Vercel dashboard, add these environment variables:

```env
# Frontend URL (your Vercel frontend URL)
FRONTEND_URL=https://your-frontend-app.vercel.app

# Environment
NODE_ENV=production

# Database
DATABASE_URL=your_production_database_url
```

## How to Test

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   Backend should start on `http://localhost:3001` (or port specified in `.env`)

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend should start on `http://localhost:5173`

3. **Check Backend Logs:**
   You should see CORS debug logs like:
   ```
   🔍 CORS Debug - Incoming origin: http://localhost:5173
   ✅ CORS: Allowing localhost origin in development: http://localhost:5173
   ```

4. **Test API Call:**
   Open browser console and make a request. You should see:
   - No CORS errors
   - Successful API responses
   - CORS headers in Network tab

## Troubleshooting

### Still Getting CORS Errors?

1. **Check Backend is Running:**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Check Port Mismatch:**
   - Backend default port: `3000`
   - If frontend calls `localhost:3001`, set `PORT=3001` in backend `.env`

3. **Check Browser Console:**
   - Look for CORS debug logs in backend terminal
   - Check Network tab for OPTIONS request status

4. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

5. **Check Backend Logs:**
   - Look for CORS debug messages
   - Check if OPTIONS requests are being received

### Common Issues

**Issue:** "No 'Access-Control-Allow-Origin' header"
- **Solution:** Backend not running or CORS middleware not applied

**Issue:** "Preflight request doesn't pass access control check"
- **Solution:** OPTIONS request blocked by rate limiter (should be fixed now)

**Issue:** "Credentials flag is true but Access-Control-Allow-Credentials is not 'true'"
- **Solution:** Already configured with `credentials: true` in corsOptions

## Additional Notes

- CORS is a **backend configuration**, not frontend
- The frontend `.env` file doesn't need CORS settings
- For production, ensure `FRONTEND_URL` matches your actual frontend domain
- In development, all localhost origins are automatically allowed

## Files Modified

1. `src/app.ts` - Reordered middleware (CORS before rate limiter)
2. `src/middleware/index.ts` - Enhanced CORS config and rate limiter skip

## Date Fixed
Fixed: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

