import { pool } from '../database/connection';

export interface DamageRecord {
  id: number;
  business_id: number;
  damage_number: string;
  damage_date: string;
  damage_type: 'damaged' | 'expired' | 'lost' | 'stolen' | 'other';
  total_cost: number;
  reason: string;
  notes?: string;
  status: 'pending' | 'processed' | 'cancelled';
  created_by: number;
  created_at: Date;
  updated_at: Date;
  lines?: DamageRecordLine[];
}

export interface DamageRecordLine {
  id: number;
  damage_record_id: number;
  item_id: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  description: string;
  code: string;
  uom?: string;
  created_at: Date;
  updated_at: Date;
}

export class DamageRecordService {
  static async createDamageRecord(businessId: number, userId: number, damageData: {
    damage_date: string;
    damage_type: 'damaged' | 'expired' | 'lost' | 'stolen' | 'other';
    reason: string;
    notes?: string;
    total_cost: number;
    lines: Array<{
      item_id: number;
      quantity: number;
      unit_cost: number;
      description: string;
      code: string;
      uom?: string;
    }>;
  }): Promise<DamageRecord> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { 
        damage_date, 
        damage_type, 
        reason, 
        notes, 
        total_cost, 
        lines 
      } = damageData;

      // Calculate total cost from lines if not provided
      const calculatedTotalCost = total_cost || lines.reduce((sum, line) => sum + (line.quantity * line.unit_cost), 0);

      // Generate damage number
      const damageNumberResult = await client.query(
        "SELECT generate_damage_number($1) as damage_number",
        [businessId.toString()]
      );
      const damage_number = damageNumberResult.rows[0].damage_number;

      // Create damage record
      const damageResult = await client.query(
        `INSERT INTO damage_records (
          business_id, damage_number, damage_date, damage_type, total_cost,
          reason, notes, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
         RETURNING *`,
        [
          businessId, damage_number, damage_date, damage_type, calculatedTotalCost,
          reason, notes, userId
        ]
      );

      const damageRecord = damageResult.rows[0];

      // Create damage record lines
      const damageLines = [];
      for (const line of lines) {
        const lineResult = await client.query(
          `INSERT INTO damage_record_lines (
            damage_record_id, item_id, quantity, unit_cost, total_cost, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            damageRecord.id, line.item_id, line.quantity, line.unit_cost,
            line.quantity * line.unit_cost, line.description, line.code, line.uom
          ]
        );
        damageLines.push(lineResult.rows[0]);
      }

      await client.query('COMMIT');

      return { ...damageRecord, lines: damageLines };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getDamageRecords(businessId: number, options: {
    page?: number;
    limit?: number;
    search?: string;
    damage_type?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ damages: DamageRecord[]; total: number; page: number; totalPages: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      damage_type,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE dr.business_id = $1';
    const queryParams: any[] = [businessId];
    let paramCount = 1;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (dr.damage_number ILIKE $${paramCount} OR dr.reason ILIKE $${paramCount} OR dr.notes ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add damage type filter
    if (damage_type) {
      paramCount++;
      whereClause += ` AND dr.damage_type = $${paramCount}`;
      queryParams.push(damage_type);
    }

    // Add status filter
    if (status) {
      paramCount++;
      whereClause += ` AND dr.status = $${paramCount}`;
      queryParams.push(status);
    }

    // Validate sort column
    const allowedSortColumns = ['damage_number', 'damage_date', 'damage_type', 'total_cost', 'status', 'created_at'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? `dr.${sortBy}` : 'dr.created_at';
    const validSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM damage_records dr ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // Get damage records with lines
    const damagesResult = await pool.query(
      `SELECT dr.*, 
        json_agg(
          json_build_object(
            'id', drl.id,
            'item_id', drl.item_id,
            'quantity', drl.quantity,
            'unit_cost', drl.unit_cost,
            'total_cost', drl.total_cost,
            'description', drl.description,
            'code', drl.code,
            'uom', drl.uom
          ) ORDER BY drl.id
        ) as lines
       FROM damage_records dr
       LEFT JOIN damage_record_lines drl ON dr.id = drl.damage_record_id
       ${whereClause}
       GROUP BY dr.id
       ORDER BY ${validSortBy} ${validSortOrder}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    return {
      damages: damagesResult.rows.map(row => ({
        ...row,
        lines: row.lines[0].id ? row.lines : [] // Handle empty left join
      })),
      total,
      page,
      totalPages
    };
  }

  static async getDamageRecordById(businessId: number, damageId: number): Promise<DamageRecord | null> {
    const result = await pool.query(
      `SELECT dr.*, 
        json_agg(
          json_build_object(
            'id', drl.id,
            'item_id', drl.item_id,
            'quantity', drl.quantity,
            'unit_cost', drl.unit_cost,
            'total_cost', drl.total_cost,
            'description', drl.description,
            'code', drl.code,
            'uom', drl.uom
          ) ORDER BY drl.id
        ) as lines
       FROM damage_records dr
       LEFT JOIN damage_record_lines drl ON dr.id = drl.damage_record_id
       WHERE dr.id = $1 AND dr.business_id = $2
       GROUP BY dr.id`,
      [damageId, businessId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      lines: row.lines[0].id ? row.lines : []
    };
  }

  static async updateDamageRecord(businessId: number, damageId: number, updateData: {
    damage_date?: string;
    damage_type?: string;
    reason?: string;
    notes?: string;
    status?: string;
  }): Promise<DamageRecord | null> {
    const existingRecord = await this.getDamageRecordById(businessId, damageId);
    if (!existingRecord) {
      return null;
    }

    // Don't allow updates to processed records
    if (existingRecord.status === 'processed') {
      throw new Error('Cannot update processed damage records');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return existingRecord;
    }

    // Add updated_at
    paramCount++;
    updates.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add WHERE clause parameters
    paramCount++;
    values.push(damageId);
    paramCount++;
    values.push(businessId);

    const result = await pool.query(
      `UPDATE damage_records SET ${updates.join(', ')} 
       WHERE id = $${paramCount - 1} AND business_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async processDamageRecord(businessId: number, damageId: number): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get the damage record with lines
      const damageRecord = await this.getDamageRecordById(businessId, damageId);
      if (!damageRecord) {
        return { success: false, message: 'Damage record not found' };
      }

      if (damageRecord.status !== 'pending') {
        return { success: false, message: 'Damage record has already been processed or cancelled' };
      }

      // Update item stock quantities (reduce quantities for damaged/lost items)
      for (const line of damageRecord.lines || []) {
        // Check if we have enough stock
        const stockCheck = await client.query(
          'SELECT quantity FROM items WHERE id = $1 AND business_id = $2',
          [line.item_id, businessId]
        );

        if (stockCheck.rows.length === 0) {
          throw new Error(`Item with ID ${line.item_id} not found`);
        }

        const currentStock = stockCheck.rows[0].quantity || 0;
        if (currentStock < line.quantity) {
          throw new Error(`Insufficient stock for item ${line.description}. Available: ${currentStock}, Required: ${line.quantity}`);
        }

        // Reduce stock quantities
        await client.query(
          `UPDATE items 
           SET quantity = quantity - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND business_id = $3`,
          [line.quantity, line.item_id, businessId]
        );
      }

      // Update damage record status to processed
      await client.query(
        `UPDATE damage_records 
         SET status = 'processed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND business_id = $2`,
        [damageId, businessId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Damage record processed successfully. Stock quantities reduced.',
        data: { damageId, itemsProcessed: damageRecord.lines?.length || 0 }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof Error) {
        return { success: false, message: error.message };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteDamageRecord(businessId: number, damageId: number): Promise<boolean> {
    const existingRecord = await this.getDamageRecordById(businessId, damageId);
    if (!existingRecord) {
      return false;
    }

    // Don't allow deletion of processed records
    if (existingRecord.status === 'processed') {
      throw new Error('Cannot delete processed damage records');
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete damage record lines first
      await client.query(
        'DELETE FROM damage_record_lines WHERE damage_record_id = $1',
        [damageId]
      );

      // Delete the damage record
      const result = await client.query(
        'DELETE FROM damage_records WHERE id = $1 AND business_id = $2',
        [damageId, businessId]
      );

      await client.query('COMMIT');

      return (result.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getDamageStats(businessId: number): Promise<{
    totalDamages: number;
    totalCost: number;
    pendingDamages: number;
    processedDamages: number;
    damagesByType: { damage_type: string; count: number; total_cost: number }[];
  }> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_damages,
         COALESCE(SUM(total_cost), 0) as total_cost,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_damages,
         COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_damages
       FROM damage_records 
       WHERE business_id = $1`,
      [businessId]
    );

    const typeStats = await pool.query(
      `SELECT 
         damage_type,
         COUNT(*) as count,
         COALESCE(SUM(total_cost), 0) as total_cost
       FROM damage_records 
       WHERE business_id = $1
       GROUP BY damage_type
       ORDER BY damage_type`,
      [businessId]
    );

    const stats = result.rows[0];
    return {
      totalDamages: parseInt(stats.total_damages),
      totalCost: parseFloat(stats.total_cost),
      pendingDamages: parseInt(stats.pending_damages),
      processedDamages: parseInt(stats.processed_damages),
      damagesByType: typeStats.rows.map(row => ({
        damage_type: row.damage_type,
        count: parseInt(row.count),
        total_cost: parseFloat(row.total_cost)
      }))
    };
  }
}