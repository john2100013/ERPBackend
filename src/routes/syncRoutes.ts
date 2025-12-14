import { Router, Request, Response } from 'express';
import { syncLocalToNeon, syncTable } from '../services/syncService';
import { setDbMode, getDbMode, isRunningOnVercel } from '../database/connection';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/sync/status
 * Get current database mode and sync status
 * Public endpoint - accessible without authentication
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const isVercel = isRunningOnVercel();
    const currentMode = getDbMode();

    res.json({
      success: true,
      data: {
        mode: currentMode,
        isVercel,
        canSwitchMode: !isVercel, // Can only switch mode when running locally
        canSync: !isVercel && currentMode === 'local', // Can only sync when local and using local DB
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: error.message,
    });
  }
});

/**
 * POST /api/sync/mode
 * Switch database mode (local or neon)
 * Only allowed when running locally
 * Public endpoint - accessible without authentication (needed for pre-login configuration)
 */
router.post('/mode', (req: Request, res: Response) => {
  try {
    if (isRunningOnVercel()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot change database mode on Vercel. Always uses Neon database.',
      });
    }

    const { mode } = req.body;

    if (!mode || (mode !== 'local' && mode !== 'neon')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mode. Must be "local" or "neon"',
      });
    }

    setDbMode(mode);

    res.json({
      success: true,
      message: `Database mode switched to ${mode}`,
      data: {
        mode: getDbMode(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to switch database mode',
      error: error.message,
    });
  }
});

// Sync operations require authentication
const syncRouter = Router();
syncRouter.use(authenticateToken);

/**
 * POST /api/sync/sync-all
 * Sync all data from local PostgreSQL to Neon database
 * Only allowed when running locally
 * Requires authentication
 */
syncRouter.post('/sync-all', async (req: Request, res: Response) => {
  try {
    if (isRunningOnVercel()) {
      return res.status(403).json({
        success: false,
        message: 'Sync is not available on Vercel. Application is directly connected to Neon database.',
      });
    }

    const currentMode = getDbMode();
    if (currentMode !== 'local') {
      return res.status(400).json({
        success: false,
        message: 'Sync is only available when using local database mode. Please switch to local mode first.',
      });
    }

    const result = await syncLocalToNeon();

    res.json({
      success: result.success,
      message: result.message,
      data: {
        syncedTables: result.syncedTables,
        stats: result.stats,
        errors: result.errors,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync data',
      error: error.message,
    });
  }
});

/**
 * POST /api/sync/sync-table
 * Sync a specific table from local PostgreSQL to Neon database
 * Requires authentication
 */
syncRouter.post('/sync-table', async (req: Request, res: Response) => {
  try {
    if (isRunningOnVercel()) {
      return res.status(403).json({
        success: false,
        message: 'Sync is not available on Vercel. Application is directly connected to Neon database.',
      });
    }

    const { tableName } = req.body;

    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required',
      });
    }

    const currentMode = getDbMode();
    if (currentMode !== 'local') {
      return res.status(400).json({
        success: false,
        message: 'Sync is only available when using local database mode. Please switch to local mode first.',
      });
    }

    const result = await syncTable(tableName);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        tableName,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync table',
      error: error.message,
    });
  }
});

// Mount authenticated sync routes
router.use('/', syncRouter);

export default router;

