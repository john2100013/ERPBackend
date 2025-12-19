import { Request, Response, NextFunction } from 'express';
import { ItemService } from '../services/itemService';

export class ItemController {
  static async createItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { item_name, quantity, buying_price, selling_price, rate, unit, description, category_id, category_1_id, category_2_id, reorder_level, manufacturing_date, expiry_date } = req.body;

      // Validation
      if (!item_name || quantity === undefined || buying_price === undefined || selling_price === undefined) {
        res.status(400).json({
          success: false,
          message: 'Item name, quantity, buying price, and selling price are required'
        });
        return;
      }

      if (quantity < 0 || buying_price < 0 || selling_price < 0) {
        res.status(400).json({
          success: false,
          message: 'Quantity, buying price, and selling price must be non-negative'
        });
        return;
      }

      const item = await ItemService.createItem(businessId, {
        item_name: item_name.trim(),
        quantity: parseFloat(quantity),
        buying_price: parseFloat(buying_price),
        selling_price: parseFloat(selling_price),
        rate: parseFloat(rate || selling_price), // Use selling_price as rate if rate not provided
        unit: unit?.trim(),
        description: description?.trim(),
        category_id: category_id ? parseInt(category_id) : undefined,
        category_1_id: category_1_id ? parseInt(category_1_id) : undefined,
        category_2_id: category_2_id ? parseInt(category_2_id) : undefined,
        reorder_level: reorder_level ? parseInt(reorder_level) : undefined,
        manufacturing_date: manufacturing_date || undefined,
        expiry_date: expiry_date || undefined
      });

      res.status(201).json({
        success: true,
        message: 'Item created successfully',
        data: { item }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      console.log(`📦 Getting items for business ID: ${businessId}`);
      
      const {
        page = '1',
        limit = '20',
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      console.log(`📦 Query params: page=${page}, limit=${limit}, search=${search}, sortBy=${sortBy}, sortOrder=${sortOrder}`);

      const result = await ItemService.getItems(businessId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: (sortOrder as string).toUpperCase() as 'ASC' | 'DESC'
      });

      console.log(`📦 Items result:`, {
        totalItems: result.total,
        itemsCount: result.items.length,
        page: result.page,
        totalPages: result.totalPages
      });
      
      if (result.items.length > 0) {
        console.log(`📦 Sample item:`, result.items[0]);
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error(`📦 Error getting items:`, error);
      next(error);
    }
  }

  static async getItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const itemId = parseInt(req.params.id);

      if (isNaN(itemId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid item ID'
        });
        return;
      }

      const item = await ItemService.getItemById(businessId, itemId);

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found'
        });
        return;
      }

      res.json({
        success: true,
        data: { item }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const itemId = parseInt(req.params.id);
      const { item_name, quantity, rate, unit, description, category_id, category_1_id, category_2_id } = req.body;

      if (isNaN(itemId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid item ID'
        });
        return;
      }

      // Validation for numeric fields
      if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) {
        res.status(400).json({
          success: false,
          message: 'Quantity must be a non-negative number'
        });
        return;
      }

      if (rate !== undefined && (isNaN(rate) || rate < 0)) {
        res.status(400).json({
          success: false,
          message: 'Rate must be a non-negative number'
        });
        return;
      }

      const updateData: any = {};
      if (item_name !== undefined) updateData.item_name = item_name.trim();
      if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
      if (rate !== undefined) updateData.rate = parseFloat(rate);
      if (unit !== undefined) updateData.unit = unit?.trim() || null;
      if (description !== undefined) updateData.description = description?.trim() || null;
      // Handle category fields: explicitly set to null if empty string, null, or undefined (to unlink categories)
      if (category_id !== undefined) {
        updateData.category_id = (category_id && category_id !== '' && category_id !== 'null') 
          ? parseInt(category_id) 
          : null;
      }
      if (category_1_id !== undefined) {
        updateData.category_1_id = (category_1_id && category_1_id !== '' && category_1_id !== 'null') 
          ? parseInt(category_1_id) 
          : null;
      }
      if (category_2_id !== undefined) {
        updateData.category_2_id = (category_2_id && category_2_id !== '' && category_2_id !== 'null') 
          ? parseInt(category_2_id) 
          : null;
      }

      const item = await ItemService.updateItem(businessId, itemId, updateData);

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Item updated successfully',
        data: { item }
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const itemId = parseInt(req.params.id);

      if (isNaN(itemId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid item ID'
        });
        return;
      }

      const deleted = await ItemService.deleteItem(businessId, itemId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Item not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error: any) {
      if (error.message === 'Cannot delete item that is used in invoices') {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }
      next(error);
    }
  }

  static async getItemStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const stats = await ItemService.getItemStats(businessId);

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getItemsByExpiry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { filter = 'week', startDate, endDate } = req.query;

      if (!['expired', 'today', 'week', 'month', 'custom'].includes(filter as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid filter. Must be: expired, today, week, month, or custom'
        });
        return;
      }

      if (filter === 'custom' && (!startDate || !endDate)) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required for custom filter'
        });
        return;
      }

      const items = await ItemService.getItemsByExpiry(
        businessId,
        filter as 'expired' | 'today' | 'week' | 'month' | 'custom',
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: { items }
      });
    } catch (error) {
      next(error);
    }
  }
}