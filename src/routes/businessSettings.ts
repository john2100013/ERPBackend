import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';

const router = express.Router();

// Get business settings for authenticated user's business
router.get('/business-settings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const result = await pool.query(
      `SELECT business_name, street, city, email, telephone, created_by, approved_by, 
              created_by_signature, approved_by_signature, logo, updated_at
       FROM business_settings 
       WHERE business_id = $1`,
      [businessId]
    );

    if (result.rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        success: true,
        data: {
          businessName: '',
          street: '',
          city: '',
          email: '',
          telephone: '',
          createdBy: '',
          approvedBy: '',
          createdBySignature: '',
          approvedBySignature: '',
          logo: '',
        }
      });
    }

    const settings = result.rows[0];
    
    res.json({
      success: true,
      data: {
        businessName: settings.business_name || '',
        street: settings.street || '',
        city: settings.city || '',
        email: settings.email || '',
        telephone: settings.telephone || '',
        createdBy: settings.created_by || '',
        approvedBy: settings.approved_by || '',
        createdBySignature: settings.created_by_signature || '',
        approvedBySignature: settings.approved_by_signature || '',
        logo: settings.logo || '',
      }
    });

  } catch (error) {
    console.error('Error fetching business settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch business settings'
    });
  }
});

// Save or update business settings
router.post('/business-settings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const {
      businessName,
      street,
      city,
      email,
      telephone,
      createdBy,
      approvedBy,
      createdBySignature,
      approvedBySignature,
      logo
    } = req.body;

    // Validate required fields
    if (!businessName || !email || !telephone) {
      return res.status(400).json({
        success: false,
        message: 'Business name, email, and telephone are required'
      });
    }

    // Check if settings already exist
    const existingResult = await pool.query(
      'SELECT id FROM business_settings WHERE business_id = $1',
      [businessId]
    );

    let result;
    
    if (existingResult.rows.length > 0) {
      // Update existing settings
      result = await pool.query(
        `UPDATE business_settings 
         SET business_name = $1, street = $2, city = $3, email = $4, telephone = $5,
             created_by = $6, approved_by = $7, created_by_signature = $8, 
             approved_by_signature = $9, logo = $10, updated_at = CURRENT_TIMESTAMP
         WHERE business_id = $11
         RETURNING *`,
        [businessName, street, city, email, telephone, createdBy, approvedBy, 
         createdBySignature, approvedBySignature, logo, businessId]
      );
    } else {
      // Insert new settings
      result = await pool.query(
        `INSERT INTO business_settings 
         (business_id, business_name, street, city, email, telephone, created_by, 
          approved_by, created_by_signature, approved_by_signature, logo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [businessId, businessName, street, city, email, telephone, createdBy, 
         approvedBy, createdBySignature, approvedBySignature, logo]
      );
    }

    res.json({
      success: true,
      message: 'Business settings saved successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error saving business settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save business settings'
    });
  }
});

export default router;