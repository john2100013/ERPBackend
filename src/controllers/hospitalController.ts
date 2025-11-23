import { Request, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import type { AuthenticatedRequest } from '../middleware/auth';

// Generate unique consultation number
const generateConsultationNumber = async (businessId: number): Promise<string> => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM consultations WHERE business_id = $1 AND DATE(created_at) = CURRENT_DATE`,
    [businessId]
  );
  const count = parseInt(result.rows[0].count) + 1;
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `CONS${date}${String(count).padStart(4, '0')}`;
};

// Generate unique prescription number
const generatePrescriptionNumber = async (businessId: number): Promise<string> => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM prescriptions WHERE business_id = $1 AND DATE(created_at) = CURRENT_DATE`,
    [businessId]
  );
  const count = parseInt(result.rows[0].count) + 1;
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `PRES${date}${String(count).padStart(4, '0')}`;
};

export class HospitalController {
  // ============ RECEPTIONIST ENDPOINTS ============
  
  // Create or get patient
  static async createOrGetPatient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const userId = req.user?.id;
      const { patient_name, national_id, location, age, phone_number, email, is_first_visit } = req.body;

      if (!patient_name) {
        res.status(400).json({ success: false, message: 'Patient name is required' });
        return;
      }

      await client.query('BEGIN');

      // Check if patient exists by national_id
      let patient;
      if (national_id) {
        const existingPatient = await client.query(
          `SELECT * FROM patients WHERE business_id = $1 AND national_id = $2`,
          [businessId, national_id]
        );
        if (existingPatient.rows.length > 0) {
          patient = existingPatient.rows[0];
          // Update patient info
          await client.query(
            `UPDATE patients SET patient_name = $1, location = $2, age = $3, phone_number = $4, email = $5, is_first_visit = $6, updated_at = NOW()
             WHERE id = $7`,
            [patient_name, location, age, phone_number, email, is_first_visit === false, patient.id]
          );
          patient = (await client.query(`SELECT * FROM patients WHERE id = $1`, [patient.id])).rows[0];
        }
      }

      // Create new patient if not found
      if (!patient) {
        const result = await client.query(
          `INSERT INTO patients (business_id, patient_name, national_id, location, age, phone_number, email, is_first_visit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [businessId, patient_name, national_id || null, location || null, age || null, phone_number || null, email || null, is_first_visit !== false]
        );
        patient = result.rows[0];
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Patient registered successfully',
        data: { patient }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Create consultation (receptionist)
  static async createConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const userId = req.user?.id;
      const { patient_id, consultation_fee } = req.body;

      if (!patient_id) {
        res.status(400).json({ success: false, message: 'Patient ID is required' });
        return;
      }

      await client.query('BEGIN');

      const consultationNumber = await generateConsultationNumber(businessId);

      const result = await client.query(
        `INSERT INTO consultations (business_id, patient_id, consultation_number, consultation_fee, receipt_generated, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [businessId, patient_id, consultationNumber, consultation_fee || 0, false, 'pending', userId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Consultation created successfully',
        data: { consultation: result.rows[0] }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Get pending consultations (for doctor)
  static async getPendingConsultations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { status = 'pending' } = req.query;

      const result = await pool.query(
        `SELECT c.*, p.patient_name, p.national_id, p.age, p.location, p.phone_number, p.is_first_visit
         FROM consultations c
         JOIN patients p ON c.patient_id = p.id
         WHERE c.business_id = $1 AND c.status = $2
         ORDER BY c.created_at ASC`,
        [businessId, status]
      );

      res.json({
        success: true,
        data: { consultations: result.rows }
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ DOCTOR ENDPOINTS ============

  // Create or update doctor visit
  static async createOrUpdateDoctorVisit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const userId = req.user?.id;
      const { consultation_id, symptoms, blood_pressure, temperature, heart_rate, other_analysis, disease_diagnosis, notes } = req.body;

      if (!consultation_id) {
        res.status(400).json({ success: false, message: 'Consultation ID is required' });
        return;
      }

      await client.query('BEGIN');

      // Get consultation to get patient_id
      const consultation = await client.query(
        `SELECT * FROM consultations WHERE id = $1 AND business_id = $2`,
        [consultation_id, businessId]
      );

      if (consultation.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Consultation not found' });
        await client.query('ROLLBACK');
        return;
      }

      const patientId = consultation.rows[0].patient_id;

      // Check if doctor visit exists
      const existingVisit = await client.query(
        `SELECT * FROM doctor_visits WHERE consultation_id = $1 AND business_id = $2`,
        [consultation_id, businessId]
      );

      let doctorVisit;
      if (existingVisit.rows.length > 0) {
        // Update existing visit
        const result = await client.query(
          `UPDATE doctor_visits SET symptoms = $1, blood_pressure = $2, temperature = $3, heart_rate = $4, 
           other_analysis = $5, disease_diagnosis = $6, notes = $7, doctor_id = $8, updated_at = NOW()
           WHERE id = $9 RETURNING *`,
          [symptoms, blood_pressure, temperature, heart_rate, other_analysis, disease_diagnosis, notes, userId, existingVisit.rows[0].id]
        );
        doctorVisit = result.rows[0];
      } else {
        // Create new visit
        const result = await client.query(
          `INSERT INTO doctor_visits (business_id, consultation_id, patient_id, symptoms, blood_pressure, temperature, 
           heart_rate, other_analysis, disease_diagnosis, notes, doctor_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
          [businessId, consultation_id, patientId, symptoms, blood_pressure, temperature, heart_rate, 
           other_analysis, disease_diagnosis, notes, userId, 'pending']
        );
        doctorVisit = result.rows[0];
      }

      // Update consultation status
      await client.query(
        `UPDATE consultations SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
        [consultation_id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Doctor visit saved successfully',
        data: { doctor_visit: doctorVisit }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Request lab tests
  static async requestLabTests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const { doctor_visit_id, tests } = req.body; // tests is array of { test_name, test_type }

      if (!doctor_visit_id || !tests || !Array.isArray(tests) || tests.length === 0) {
        res.status(400).json({ success: false, message: 'Doctor visit ID and tests array are required' });
        return;
      }

      await client.query('BEGIN');

      // Get doctor visit to get patient_id
      const doctorVisit = await client.query(
        `SELECT * FROM doctor_visits WHERE id = $1 AND business_id = $2`,
        [doctor_visit_id, businessId]
      );

      if (doctorVisit.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Doctor visit not found' });
        await client.query('ROLLBACK');
        return;
      }

      const patientId = doctorVisit.rows[0].patient_id;

      // Create lab tests
      const createdTests = [];
      for (const test of tests) {
        const result = await client.query(
          `INSERT INTO lab_tests (business_id, doctor_visit_id, patient_id, test_name, test_type, test_status)
           VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
          [businessId, doctor_visit_id, patientId, test.test_name, test.test_type || null]
        );
        createdTests.push(result.rows[0]);
      }

      // Update doctor visit status
      await client.query(
        `UPDATE doctor_visits SET lab_test_required = TRUE, status = 'waiting_lab', updated_at = NOW() WHERE id = $1`,
        [doctor_visit_id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Lab tests requested successfully',
        data: { lab_tests: createdTests }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Create prescription
  static async createPrescription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const userId = req.user?.id;
      const { doctor_visit_id, items } = req.body; // items is array of { item_id, quantity_prescribed, unit_price }

      if (!doctor_visit_id || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, message: 'Doctor visit ID and items array are required' });
        return;
      }

      await client.query('BEGIN');

      // Get doctor visit to get patient_id
      const doctorVisit = await client.query(
        `SELECT * FROM doctor_visits WHERE id = $1 AND business_id = $2`,
        [doctor_visit_id, businessId]
      );

      if (doctorVisit.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Doctor visit not found' });
        await client.query('ROLLBACK');
        return;
      }

      const patientId = doctorVisit.rows[0].patient_id;
      const prescriptionNumber = await generatePrescriptionNumber(businessId);

      // Create prescription
      let totalAmount = 0;
      const prescriptionResult = await client.query(
        `INSERT INTO prescriptions (business_id, doctor_visit_id, patient_id, prescription_number, status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
        [businessId, doctor_visit_id, patientId, prescriptionNumber]
      );
      const prescription = prescriptionResult.rows[0];

      // Create prescription items and calculate total
      const prescriptionItems = [];
      for (const item of items) {
        // Get item details
        const itemDetails = await client.query(
          `SELECT name, quantity, selling_price FROM items WHERE id = $1 AND business_id = $2`,
          [item.item_id, businessId]
        );

        if (itemDetails.rows.length === 0) {
          continue; // Skip if item not found
        }

        const itemData = itemDetails.rows[0];
        const quantityPrescribed = parseFloat(item.quantity_prescribed);
        const unitPrice = parseFloat(item.unit_price || itemData.selling_price);
        const totalPrice = quantityPrescribed * unitPrice;
        totalAmount += totalPrice;

        const quantityAvailable = parseFloat(itemData.quantity || 0);
        const isAvailable = quantityAvailable >= quantityPrescribed;

        const result = await client.query(
          `INSERT INTO prescription_items (prescription_id, item_id, item_name, quantity_prescribed, quantity_available, 
           unit_price, total_price, is_available, is_missing)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [prescription.id, item.item_id, itemData.name, quantityPrescribed, quantityAvailable, 
           unitPrice, totalPrice, isAvailable, !isAvailable]
        );
        prescriptionItems.push(result.rows[0]);
      }

      // Update prescription total
      await client.query(
        `UPDATE prescriptions SET total_amount = $1, updated_at = NOW() WHERE id = $2`,
        [totalAmount, prescription.id]
      );

      // Update doctor visit status
      await client.query(
        `UPDATE doctor_visits SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [doctor_visit_id]
      );

      // Update consultation status
      await client.query(
        `UPDATE consultations SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [doctorVisit.rows[0].consultation_id]
      );

      await client.query('COMMIT');

      const updatedPrescription = (await client.query(`SELECT * FROM prescriptions WHERE id = $1`, [prescription.id])).rows[0];

      res.json({
        success: true,
        message: 'Prescription created successfully',
        data: { 
          prescription: updatedPrescription,
          items: prescriptionItems
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Get doctor visit by consultation ID
  static async getDoctorVisitByConsultation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { consultation_id } = req.query;

      if (!consultation_id) {
        res.status(400).json({ success: false, message: 'Consultation ID is required' });
        return;
      }

      const result = await pool.query(
        `SELECT dv.*, p.patient_name, p.national_id, p.age, c.consultation_number
         FROM doctor_visits dv
         JOIN patients p ON dv.patient_id = p.id
         JOIN consultations c ON dv.consultation_id = c.id
         WHERE dv.consultation_id = $1 AND dv.business_id = $2`,
        [consultation_id, businessId]
      );

      if (result.rows.length === 0) {
        res.json({
          success: true,
          data: { doctor_visit: null }
        });
        return;
      }

      // Get lab tests for this visit
      const labTests = await pool.query(
        `SELECT * FROM lab_tests WHERE doctor_visit_id = $1`,
        [result.rows[0].id]
      );

      res.json({
        success: true,
        data: { 
          doctor_visit: {
            ...result.rows[0],
            lab_tests: labTests.rows
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get lab test results for doctor
  static async getLabTestResults(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { doctor_visit_id } = req.query;

      let query = `
        SELECT lt.*, p.patient_name, p.national_id, dv.disease_diagnosis
        FROM lab_tests lt
        JOIN patients p ON lt.patient_id = p.id
        JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
        WHERE lt.business_id = $1
      `;
      const params: any[] = [businessId];

      if (doctor_visit_id) {
        query += ` AND lt.doctor_visit_id = $2`;
        params.push(doctor_visit_id);
      } else {
        query += ` AND lt.test_status = 'completed'`;
      }

      query += ` ORDER BY lt.test_completed_at DESC`;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: { lab_tests: result.rows }
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ LAB ENDPOINTS ============

  // Get pending lab tests
  static async getPendingLabTests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;

      const result = await pool.query(
        `SELECT lt.*, p.patient_name, p.national_id, p.age, dv.symptoms, dv.disease_diagnosis
         FROM lab_tests lt
         JOIN patients p ON lt.patient_id = p.id
         LEFT JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         WHERE lt.business_id = $1 AND lt.test_status = 'pending'
         ORDER BY lt.test_requested_at ASC`,
        [businessId]
      );

      res.json({
        success: true,
        data: { lab_tests: result.rows }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update lab test result
  static async updateLabTestResult(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const userId = req.user?.id;
      const { lab_test_id, test_result } = req.body;

      if (!lab_test_id || !test_result) {
        res.status(400).json({ success: false, message: 'Lab test ID and result are required' });
        return;
      }

      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE lab_tests SET test_result = $1, test_status = 'completed', test_completed_at = NOW(), 
         lab_technician_id = $2, updated_at = NOW()
         WHERE id = $3 AND business_id = $4 RETURNING *`,
        [test_result, userId, lab_test_id, businessId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Lab test not found' });
        await client.query('ROLLBACK');
        return;
      }

      const labTest = result.rows[0];
      const doctorVisitId = labTest.doctor_visit_id;

      // Check if all lab tests for this doctor visit are completed
      const allTests = await client.query(
        `SELECT * FROM lab_tests WHERE doctor_visit_id = $1 AND business_id = $2`,
        [doctorVisitId, businessId]
      );

      const allCompleted = allTests.rows.every((test: any) => test.test_status === 'completed');

      // If all tests are completed, update doctor visit status back to 'pending' 
      // to indicate the doctor can now review results and complete the visit
      if (allCompleted) {
        await client.query(
          `UPDATE doctor_visits SET status = 'pending', updated_at = NOW() WHERE id = $1`,
          [doctorVisitId]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Lab test result updated successfully',
        data: { lab_test: result.rows[0] }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // ============ PHARMACY ENDPOINTS ============

  // Get pending prescriptions
  static async getPendingPrescriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;

      const result = await pool.query(
        `SELECT pr.*, p.patient_name, p.national_id, p.age, dv.disease_diagnosis
         FROM prescriptions pr
         JOIN patients p ON pr.patient_id = p.id
         LEFT JOIN doctor_visits dv ON pr.doctor_visit_id = dv.id
         WHERE pr.business_id = $1 AND pr.pharmacy_served = FALSE
         ORDER BY pr.created_at ASC`,
        [businessId]
      );

      res.json({
        success: true,
        data: { prescriptions: result.rows }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get prescription items
  static async getPrescriptionItems(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      // Get prescription_id from URL path parameter (not query parameter)
      const prescription_id = parseInt(req.params.id, 10);

      if (!prescription_id || isNaN(prescription_id)) {
        res.status(400).json({ success: false, message: 'Prescription ID is required and must be a valid number' });
        return;
      }

      const result = await pool.query(
        `SELECT pi.*, i.quantity as current_stock
         FROM prescription_items pi
         LEFT JOIN items i ON pi.item_id = i.id
         WHERE pi.prescription_id = $1
         ORDER BY pi.id`,
        [prescription_id]
      );

      // Verify prescription belongs to business
      const prescription = await pool.query(
        `SELECT * FROM prescriptions WHERE id = $1 AND business_id = $2`,
        [prescription_id, businessId]
      );

      if (prescription.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Prescription not found' });
        return;
      }

      res.json({
        success: true,
        data: { 
          prescription: prescription.rows[0],
          items: result.rows 
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Fulfill prescription (pharmacy billing)
  static async fulfillPrescription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const userId = req.user?.id;
      const { prescription_id, items, financial_account_id } = req.body;
      // items is array of { prescription_item_id, quantity_fulfilled, is_available }

      if (!prescription_id || !items || !Array.isArray(items)) {
        res.status(400).json({ success: false, message: 'Prescription ID and items array are required' });
        return;
      }

      await client.query('BEGIN');

      // Get prescription
      const prescription = await client.query(
        `SELECT * FROM prescriptions WHERE id = $1 AND business_id = $2`,
        [prescription_id, businessId]
      );

      if (prescription.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Prescription not found' });
        await client.query('ROLLBACK');
        return;
      }

      let totalAmount = 0;
      let allFulfilled = true;
      let partiallyFulfilled = false;

      // Update prescription items and calculate totals
      for (const item of items) {
        const prescriptionItem = await client.query(
          `SELECT * FROM prescription_items WHERE id = $1 AND prescription_id = $2`,
          [item.prescription_item_id, prescription_id]
        );

        if (prescriptionItem.rows.length === 0) continue;

        const pi = prescriptionItem.rows[0];
        const quantityFulfilled = parseFloat(item.quantity_fulfilled || 0);
        const isAvailable = item.is_available !== false;

        if (quantityFulfilled > 0 && isAvailable) {
          totalAmount += quantityFulfilled * parseFloat(pi.unit_price);
          partiallyFulfilled = true;

          // Update stock
          await client.query(
            `UPDATE items SET quantity = quantity - $1, updated_at = NOW() 
             WHERE id = $2 AND business_id = $3`,
            [quantityFulfilled, pi.item_id, businessId]
          );
        }

        // Update prescription item
        await client.query(
          `UPDATE prescription_items SET quantity_fulfilled = $1, is_available = $2, is_missing = $3, updated_at = NOW()
           WHERE id = $4`,
          [quantityFulfilled, isAvailable, !isAvailable, item.prescription_item_id]
        );

        // Check if fully fulfilled
        if (quantityFulfilled < parseFloat(pi.quantity_prescribed)) {
          allFulfilled = false;
        }
      }

      // Determine prescription status
      let prescriptionStatus = 'pending';
      if (allFulfilled) {
        prescriptionStatus = 'fulfilled';
      } else if (partiallyFulfilled) {
        prescriptionStatus = 'partially_fulfilled';
      }

      // Update prescription
      await client.query(
        `UPDATE prescriptions SET status = $1, total_amount = $2, amount_paid = $3, pharmacy_served = TRUE, 
         served_by = $4, served_at = NOW(), updated_at = NOW() WHERE id = $5`,
        [prescriptionStatus, totalAmount, totalAmount, userId, prescription_id]
      );

      // Update financial account if provided
      if (financial_account_id && totalAmount > 0) {
        await client.query(
          `UPDATE financial_accounts SET current_balance = current_balance + $1, updated_at = NOW()
           WHERE id = $2 AND business_id = $3`,
          [totalAmount, financial_account_id, businessId]
        );
      }

      await client.query('COMMIT');

      const updatedPrescription = (await client.query(`SELECT * FROM prescriptions WHERE id = $1`, [prescription_id])).rows[0];

      res.json({
        success: true,
        message: 'Prescription fulfilled successfully',
        data: { prescription: updatedPrescription }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
}

