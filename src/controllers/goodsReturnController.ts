import { Request, Response, NextFunction } from 'express';
import { GoodsReturnService } from '../services/goodsReturnService';

export class GoodsReturnController {
  static async getReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { page, limit, search, status, sortBy, sortOrder } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        status: status as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'ASC' | 'DESC'
      };

      const result = await GoodsReturnService.getReturns(businessId, options);

      res.json({
        success: true,
        message: 'Goods returns retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async createReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const userId = (req as any).user.id;
      const { 
        customer_name, 
        invoice_id, 
        return_date, 
        reason, 
        notes, 
        refund_method, 
        financial_account_id,
        refund_amount,
        lines 
      } = req.body;

      // Validation
      if (!customer_name || !lines || lines.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Customer name and return lines are required'
        });
        return;
      }

      // Validate lines
      const invalidLines = lines.some((line: any) => 
        !line.item_id || line.quantity <= 0 || line.unit_price < 0
      );
      if (invalidLines) {
        res.status(400).json({
          success: false,
          message: 'All lines must have valid item, quantity, and unit price'
        });
        return;
      }

      const goodsReturn = await GoodsReturnService.createReturn(businessId, userId, {
        customer_name,
        invoice_id: invoice_id || null,
        return_date: return_date || new Date().toISOString().split('T')[0],
        reason: reason || null,
        notes: notes || null,
        refund_method: refund_method || null,
        financial_account_id: financial_account_id || null,
        refund_amount: refund_amount || 0,
        lines
      });

      res.status(201).json({
        success: true,
        message: 'Goods return created successfully',
        data: goodsReturn
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReturnById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const returnId = parseInt(req.params.id);

      if (isNaN(returnId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid return ID'
        });
        return;
      }

      const goodsReturn = await GoodsReturnService.getReturnById(businessId, returnId);

      if (!goodsReturn) {
        res.status(404).json({
          success: false,
          message: 'Goods return not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Goods return retrieved successfully',
        data: goodsReturn
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const returnId = parseInt(req.params.id);
      const updateData = req.body;

      if (isNaN(returnId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid return ID'
        });
        return;
      }

      const goodsReturn = await GoodsReturnService.updateReturn(businessId, returnId, updateData);

      if (!goodsReturn) {
        res.status(404).json({
          success: false,
          message: 'Goods return not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Goods return updated successfully',
        data: goodsReturn
      });
    } catch (error) {
      next(error);
    }
  }

  static async processReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const returnId = parseInt(req.params.id);

      if (isNaN(returnId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid return ID'
        });
        return;
      }

      const result = await GoodsReturnService.processReturn(businessId, returnId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.json({
        success: true,
        message: 'Goods return processed successfully. Stock and accounts updated.',
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const returnId = parseInt(req.params.id);

      if (isNaN(returnId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid return ID'
        });
        return;
      }

      const deleted = await GoodsReturnService.deleteReturn(businessId, returnId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Goods return not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Goods return deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}