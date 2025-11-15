import { Request, Response, NextFunction } from 'express';
import { DamageRecordService } from '../services/damageRecordService';

export class DamageRecordController {
  static async getDamageRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { page, limit, search, damage_type, status, sortBy, sortOrder } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        damage_type: damage_type as string,
        status: status as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'ASC' | 'DESC'
      };

      const result = await DamageRecordService.getDamageRecords(businessId, options);

      res.json({
        success: true,
        message: 'Damage records retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDamageRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const userId = (req as any).user.id;
      const { 
        damage_date, 
        damage_type, 
        reason, 
        notes,
        total_cost,
        lines 
      } = req.body;

      // Validation
      if (!damage_date || !damage_type || !reason || !lines || lines.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Damage date, type, reason, and damage lines are required'
        });
        return;
      }

      // Validate damage type
      const validTypes = ['damaged', 'expired', 'lost', 'stolen', 'other'];
      if (!validTypes.includes(damage_type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid damage type'
        });
        return;
      }

      // Validate lines
      const invalidLines = lines.some((line: any) => 
        !line.item_id || line.quantity <= 0 || line.unit_cost < 0
      );
      if (invalidLines) {
        res.status(400).json({
          success: false,
          message: 'All lines must have valid item, quantity, and unit cost'
        });
        return;
      }

      const damageRecord = await DamageRecordService.createDamageRecord(businessId, userId, {
        damage_date,
        damage_type,
        reason,
        notes: notes || null,
        total_cost: total_cost || 0,
        lines
      });

      res.status(201).json({
        success: true,
        message: 'Damage record created successfully',
        data: damageRecord
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDamageRecordById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const damageId = parseInt(req.params.id);

      if (isNaN(damageId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid damage record ID'
        });
        return;
      }

      const damageRecord = await DamageRecordService.getDamageRecordById(businessId, damageId);

      if (!damageRecord) {
        res.status(404).json({
          success: false,
          message: 'Damage record not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Damage record retrieved successfully',
        data: damageRecord
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateDamageRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const damageId = parseInt(req.params.id);
      const updateData = req.body;

      if (isNaN(damageId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid damage record ID'
        });
        return;
      }

      const damageRecord = await DamageRecordService.updateDamageRecord(businessId, damageId, updateData);

      if (!damageRecord) {
        res.status(404).json({
          success: false,
          message: 'Damage record not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Damage record updated successfully',
        data: damageRecord
      });
    } catch (error) {
      next(error);
    }
  }

  static async processDamageRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const damageId = parseInt(req.params.id);

      if (isNaN(damageId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid damage record ID'
        });
        return;
      }

      const result = await DamageRecordService.processDamageRecord(businessId, damageId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.json({
        success: true,
        message: 'Damage record processed successfully. Stock quantities updated.',
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDamageRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const damageId = parseInt(req.params.id);

      if (isNaN(damageId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid damage record ID'
        });
        return;
      }

      const deleted = await DamageRecordService.deleteDamageRecord(businessId, damageId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Damage record not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Damage record deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}