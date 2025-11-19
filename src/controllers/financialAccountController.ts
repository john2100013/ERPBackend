import { Request, Response, NextFunction } from 'express';
import { FinancialAccountService } from '../services/financialAccountService';

export class FinancialAccountController {
  static async getAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { page, limit, search, sortBy, sortOrder } = req.query;

      const options = {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'ASC' | 'DESC'
      };

      const result = await FinancialAccountService.getAccounts(businessId, options);

      res.json({
        success: true,
        message: 'Financial accounts retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { account_name, account_type, account_number, balance } = req.body;

      // Validation
      if (!account_name || !account_type) {
        res.status(400).json({
          success: false,
          message: 'Account name and type are required'
        });
        return;
      }

      if (!['cash', 'bank', 'mobile_money'].includes(account_type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account type. Must be cash, bank, or mobile_money'
        });
        return;
      }

      const account = await FinancialAccountService.createAccount(businessId, {
        account_name: account_name.trim(),
        account_type,
        account_number: account_number?.trim(),
        balance: parseFloat(balance) || 0
      });

      res.status(201).json({
        success: true,
        message: 'Financial account created successfully',
        data: account
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAccountById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const accountId = parseInt(req.params.id);

      if (isNaN(accountId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account ID'
        });
        return;
      }

      const account = await FinancialAccountService.getAccountById(businessId, accountId);

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Financial account not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Financial account retrieved successfully',
        data: account
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const accountId = parseInt(req.params.id);
      const { account_name, account_type, account_number, balance, is_active } = req.body;

      if (isNaN(accountId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account ID'
        });
        return;
      }

      if (account_type && !['cash', 'bank', 'mobile_money'].includes(account_type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account type. Must be cash, bank, or mobile_money'
        });
        return;
      }

      const updateData: any = {};
      if (account_name !== undefined) updateData.account_name = account_name.trim();
      if (account_type !== undefined) updateData.account_type = account_type;
      if (account_number !== undefined) updateData.account_number = account_number?.trim();
      if (balance !== undefined) updateData.balance = parseFloat(balance);
      if (is_active !== undefined) updateData.is_active = is_active;

      const account = await FinancialAccountService.updateAccount(businessId, accountId, updateData);

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Financial account not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Financial account updated successfully',
        data: account
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const accountId = parseInt(req.params.id);

      if (isNaN(accountId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account ID'
        });
        return;
      }

      const deleted = await FinancialAccountService.deleteAccount(businessId, accountId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Financial account not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Financial account deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAccountBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const accountId = parseInt(req.params.id);

      if (isNaN(accountId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account ID'
        });
        return;
      }

      const account = await FinancialAccountService.getAccountById(businessId, accountId);

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Financial account not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Account balance retrieved successfully',
        data: {
          account_id: account.id,
          account_name: account.account_name,
          balance: account.current_balance
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAccountBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const accountId = parseInt(req.params.id);
      const { amount, operation } = req.body;

      if (isNaN(accountId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid account ID'
        });
        return;
      }

      if (!amount || isNaN(amount)) {
        res.status(400).json({
          success: false,
          message: 'Valid amount is required'
        });
        return;
      }

      if (!operation || !['add', 'subtract'].includes(operation)) {
        res.status(400).json({
          success: false,
          message: 'Operation must be "add" or "subtract"'
        });
        return;
      }

      const account = await FinancialAccountService.updateAccountBalance(accountId, parseFloat(amount), operation);

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Financial account not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Account balance updated successfully',
        data: { account }
      });
    } catch (error) {
      next(error);
    }
  }
}