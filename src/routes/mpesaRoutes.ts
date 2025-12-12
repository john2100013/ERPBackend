import express from 'express';
import axios from 'axios';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';
import { generateMpesaAccessToken, getMpesaBaseUrl } from '../utils/mpesaAuth';

const router = express.Router();

// M-Pesa C2B Confirmation Callback (Public endpoint - Safaricom calls this)
router.post('/c2b/confirmation', async (req, res) => {
  try {
    console.log('📱 M-Pesa C2B Confirmation received:', JSON.stringify(req.body, null, 2));
    
    const {
      TransactionType,
      TransID,
      TransTime,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      InvoiceNumber,
      OrgAccountBalance,
      ThirdPartyTransID,
      MSISDN,
      FirstName,
      MiddleName,
      LastName,
    } = req.body;

    // Try to extract business_id from BusinessShortCode or BillRefNumber
    // You can customize this logic based on your Till Number setup
    let businessId: number | null = null;
    
    // Option 1: If you store business_id in BillRefNumber format (e.g., "BIZ123")
    // Option 2: Match BusinessShortCode to business settings
    // For now, we'll store without business_id and link it when user selects
    
    // Store the confirmation
    const result = await pool.query(`
      INSERT INTO mpesa_confirmations (
        business_id,
        transaction_type,
        trans_id,
        trans_time,
        trans_amount,
        business_short_code,
        bill_ref_number,
        invoice_number,
        org_account_balance,
        third_party_trans_id,
        msisdn,
        first_name,
        middle_name,
        last_name,
        result_code,
        result_desc,
        is_processed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (trans_id) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      businessId, // business_id - will be set when linked to invoice
      TransactionType || 'C2B',
      TransID,
      TransTime,
      parseFloat(TransAmount) || 0,
      BusinessShortCode,
      BillRefNumber || '',
      InvoiceNumber || '',
      parseFloat(OrgAccountBalance) || 0,
      ThirdPartyTransID || '',
      MSISDN || '',
      FirstName || '',
      MiddleName || '',
      LastName || '',
      0, // result_code - success
      'Payment received', // result_desc
      false // is_processed
    ]);

    console.log('✅ M-Pesa confirmation stored:', result.rows[0].id);

    // Respond to Safaricom (required format)
    res.json({
      ResultCode: 0,
      ResultDesc: 'Confirmation received successfully'
    });

  } catch (error: any) {
    console.error('❌ Error processing M-Pesa confirmation:', error);
    
    // Still respond to Safaricom to acknowledge receipt
    res.json({
      ResultCode: 1,
      ResultDesc: 'Error processing confirmation'
    });
  }
});

// M-Pesa C2B Validation Callback (Public endpoint - Safaricom calls this)
router.post('/c2b/validation', async (req, res) => {
  try {
    console.log('📱 M-Pesa C2B Validation received:', JSON.stringify(req.body, null, 2));
    
    // Validate the payment request
    // You can add validation logic here
    
    // Respond to Safaricom
    res.json({
      ResultCode: 0,
      ResultDesc: 'Accepted'
    });

  } catch (error: any) {
    console.error('❌ Error processing M-Pesa validation:', error);
    res.json({
      ResultCode: 1,
      ResultDesc: 'Error processing validation'
    });
  }
});

// Get pending M-Pesa confirmations (for linking to invoices)
router.get('/confirmations/pending', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get unlinked confirmations for this business or all unlinked if business_id is null
    const result = await pool.query(`
      SELECT 
        id,
        trans_id,
        trans_time,
        trans_amount,
        business_short_code,
        bill_ref_number,
        invoice_number,
        msisdn,
        first_name,
        middle_name,
        last_name,
        created_at,
        linked_invoice_id,
        is_processed
      FROM mpesa_confirmations
      WHERE (business_id IS NULL OR business_id = $1)
        AND linked_invoice_id IS NULL
        AND is_processed = FALSE
      ORDER BY created_at DESC
      LIMIT 50
    `, [businessId]);

    res.json({
      success: true,
      data: {
        confirmations: result.rows
      }
    });

  } catch (error: any) {
    console.error('Error fetching M-Pesa confirmations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch M-Pesa confirmations'
    });
  }
});

// Link M-Pesa confirmation to invoice
router.post('/confirmations/:id/link', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const confirmationId = parseInt(req.params.id);
    const { invoice_id } = req.body;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'Invoice ID is required'
      });
    }

    // Verify invoice belongs to business
    const invoiceCheck = await pool.query(`
      SELECT id FROM invoices WHERE id = $1 AND business_id = $2
    `, [invoice_id, businessId]);

    if (invoiceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Link confirmation to invoice
    const result = await pool.query(`
      UPDATE mpesa_confirmations
      SET 
        business_id = $1,
        linked_invoice_id = $2,
        linked_at = CURRENT_TIMESTAMP,
        is_processed = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND linked_invoice_id IS NULL
      RETURNING *
    `, [businessId, invoice_id, confirmationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Confirmation not found or already linked'
      });
    }

    // Update invoice with M-Pesa code
    await pool.query(`
      UPDATE invoices
      SET 
        mpesa_code = $1,
        payment_method = 'M-Pesa',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [result.rows[0].trans_id, invoice_id]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'M-Pesa confirmation linked to invoice successfully'
    });

  } catch (error: any) {
    console.error('Error linking M-Pesa confirmation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link M-Pesa confirmation'
    });
  }
});

// Get all confirmations for a business (with filters)
router.get('/confirmations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const { linked, limit = 50 } = req.query;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    let query = `
      SELECT 
        id,
        trans_id,
        trans_time,
        trans_amount,
        business_short_code,
        bill_ref_number,
        invoice_number,
        msisdn,
        first_name,
        middle_name,
        last_name,
        created_at,
        linked_invoice_id,
        is_processed,
        linked_at
      FROM mpesa_confirmations
      WHERE business_id = $1
    `;

    const params: any[] = [businessId];

    if (linked === 'true') {
      query += ' AND linked_invoice_id IS NOT NULL';
    } else if (linked === 'false') {
      query += ' AND linked_invoice_id IS NULL';
    }

    query += ' ORDER BY created_at DESC LIMIT $2';
    params.push(parseInt(limit as string));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        confirmations: result.rows
      }
    });

  } catch (error: any) {
    console.error('Error fetching M-Pesa confirmations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch M-Pesa confirmations'
    });
  }
});

// Generate M-Pesa Access Token (for testing/admin use)
router.get('/access-token', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const accessToken = await generateMpesaAccessToken();
    res.json({
      success: true,
      data: {
        access_token: accessToken,
        expires_in: 3600 // M-Pesa tokens typically expire in 1 hour
      }
    });
  } catch (error: any) {
    console.error('Error generating access token:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate access token'
    });
  }
});

// C2B Register URLs - Register confirmation and validation URLs with Safaricom
router.post('/c2b/register-urls', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      shortcode, 
      confirmation_url, 
      validation_url,
      response_type = 'Completed' // 'Completed' or 'Cancelled'
    } = req.body;

    // Validate required fields
    if (!shortcode) {
      return res.status(400).json({
        success: false,
        message: 'Shortcode is required'
      });
    }

    if (!confirmation_url) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation URL is required'
      });
    }

    // Generate access token
    const accessToken = await generateMpesaAccessToken();
    const baseUrl = getMpesaBaseUrl();

    // Prepare request payload
    const payload = {
      ShortCode: shortcode,
      ResponseType: response_type,
      ConfirmationURL: confirmation_url,
      ValidationURL: validation_url || confirmation_url, // Use confirmation URL if validation not provided
    };

    console.log('📝 Registering C2B URLs with Safaricom:', payload);

    // Call M-Pesa C2B Register URLs API
    const response = await axios.post(
      `${baseUrl}/mpesa/c2b/v1/registerurl`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ C2B URLs registered successfully:', response.data);

    res.json({
      success: true,
      data: response.data,
      message: 'C2B URLs registered successfully with Safaricom'
    });

  } catch (error: any) {
    console.error('❌ Error registering C2B URLs:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.errorMessage || error.message || 'Failed to register C2B URLs',
      error: error.response?.data
    });
  }
});

export default router;

