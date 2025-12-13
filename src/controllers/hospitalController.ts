import { Request, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import type { AuthenticatedRequest } from '../middleware/auth';

// Get the next consultation number candidate
// This function must be called within a transaction with advisory lock already held
const getNextConsultationNumberCandidate = async (
  businessId: number, 
  client: any,
  startCount?: number
): Promise<{ number: string; nextCount: number }> => {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `CONS${date}`;
  
  let count: number;
  
  if (startCount !== undefined) {
    // Use provided starting count (for retries)
    count = startCount;
  } else {
    // Get the maximum consultation number for today
    const result = await client.query(
      `SELECT consultation_number FROM consultations 
       WHERE business_id = $1 AND consultation_number LIKE $2 
       ORDER BY consultation_number DESC LIMIT 1`,
      [businessId, `${prefix}%`]
    );
    
    // Start from 1 or increment from the last number
    count = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].consultation_number;
      const sequencePart = lastNumber.replace(prefix, '');
      const lastCount = parseInt(sequencePart, 10);
      if (!isNaN(lastCount)) {
        count = lastCount + 1;
      }
    }
  }
  
  const number = `${prefix}${String(count).padStart(4, '0')}`;
  return { number, nextCount: count + 1 };
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

      // Use advisory lock to serialize number generation - this blocks other transactions
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const dateAsInt = parseInt(date, 10);
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [businessId, dateAsInt]);

      // Lock ALL existing consultation numbers for today to prevent concurrent modifications
      await client.query(
        `SELECT consultation_number FROM consultations 
         WHERE business_id = $1 AND consultation_number LIKE $2 
         FOR UPDATE`,
        [businessId, `CONS${date}%`]
      );

      // Try to insert with retry logic for duplicate key errors
      // Use SAVEPOINTs to handle errors without aborting the entire transaction
      const maxAttempts = 50;
      let consultationNumber: string | null = null;
      let result: any = null;
      let nextCount: number | undefined = undefined;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Create a savepoint before each attempt
        const savepointName = `sp_attempt_${attempt}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          
          // Get next consultation number candidate
          const candidate = await getNextConsultationNumberCandidate(businessId, client, nextCount);
          consultationNumber = candidate.number;
          nextCount = candidate.nextCount;
          
          // Try to insert
          result = await client.query(
            `INSERT INTO consultations (business_id, patient_id, consultation_number, consultation_fee, receipt_generated, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [businessId, patient_id, consultationNumber, consultation_fee || 0, false, 'pending', userId]
          );
          
          // Success! Release savepoint and break out of loop
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          break;
        } catch (insertError: any) {
          // Rollback to savepoint to recover from the error
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          
          // If it's a duplicate key error, try again with next number
          if (insertError.code === '23505' && insertError.constraint === 'consultations_consultation_number_key') {
            if (attempt < maxAttempts - 1) {
              // Continue to next iteration with incremented count
              continue;
            } else {
              throw new Error(`Failed to generate unique consultation number after ${maxAttempts} attempts`);
            }
          } else {
            // Some other error, rethrow
            throw insertError;
          }
        }
      }

      if (!result || !consultationNumber) {
        throw new Error('Failed to create consultation');
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Consultation created successfully',
        data: { consultation: result.rows[0] }
      });
    } catch (error: any) {
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
      const { doctor_visit_id, tests } = req.body; // tests is array of { test_name, test_type, category, others, price }

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

      // Calculate total amount for all tests
      let totalAmount = 0;
      const createdTests = [];
      
      for (const test of tests) {
        const price = parseFloat(test.price || 0);
        totalAmount += price;
        
        const result = await client.query(
          `INSERT INTO lab_tests (business_id, doctor_visit_id, patient_id, test_name, test_type, category, others, price, amount_due, payment_status, test_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unpaid', 'pending') RETURNING *`,
          [
            businessId, 
            doctor_visit_id, 
            patientId, 
            test.test_name, 
            test.test_type || null,
            test.category || null,
            test.others || null,
            price,
            price
          ]
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
        data: { lab_tests: createdTests, total_amount: totalAmount }
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
      const { doctor_visit_id, all_results } = req.query;

      // Use LEFT JOIN to handle cases where consultations might not exist
      let query = `
        SELECT 
          lt.id,
          lt.business_id,
          lt.doctor_visit_id,
          lt.patient_id,
          lt.test_name,
          lt.test_type,
          lt.test_requested_at,
          lt.test_completed_at,
          lt.test_result,
          lt.test_status,
          lt.lab_technician_id,
          lt.attachment_url,
          lt.attachment_filename,
          lt.created_at,
          lt.updated_at,
          p.patient_name, 
          p.national_id, 
          COALESCE(dv.disease_diagnosis, '') as disease_diagnosis,
          COALESCE(dv.symptoms, '') as symptoms,
          COALESCE(c.consultation_number, '') as consultation_number,
          COALESCE(c.created_at, lt.created_at) as consultation_date
        FROM lab_tests lt
        INNER JOIN patients p ON lt.patient_id = p.id AND p.business_id = $1
        LEFT JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id AND dv.business_id = $1
        LEFT JOIN consultations c ON dv.consultation_id = c.id AND c.business_id = $1
        WHERE lt.business_id = $1
      `;
      const params: any[] = [businessId];

      if (doctor_visit_id) {
        query += ` AND lt.doctor_visit_id = $${params.length + 1}`;
        params.push(doctor_visit_id);
      } else if (all_results === 'true') {
        // Get all completed results for the doctor
        query += ` AND lt.test_status = 'completed'`;
      } else {
        // Default: get completed results for current visit
        query += ` AND lt.test_status = 'completed'`;
      }

      query += ` ORDER BY lt.test_completed_at DESC NULLS LAST, lt.test_requested_at DESC`;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: { lab_tests: result.rows }
      });
    } catch (error: any) {
      console.error('Error in getLabTestResults:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lab test results',
        error: error.message
      });
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

  // Get grouped pending lab tests by patient/doctor_visit for lab screen
  static async getGroupedPendingLabTests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;

      // Get grouped lab tests by doctor_visit_id
      const groupedResult = await pool.query(
        `SELECT 
          dv.id as doctor_visit_id,
          p.id as patient_id,
          p.patient_name,
          p.national_id,
          MIN(lt.test_requested_at) as requested_at,
          COUNT(lt.id) as test_count,
          SUM(CASE WHEN lt.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
          SUM(CASE WHEN lt.payment_status != 'paid' THEN 1 ELSE 0 END) as unpaid_count,
          MAX(lt.payment_status) as payment_status,
          MAX(lt.test_status) as test_status
         FROM lab_tests lt
         JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         JOIN patients p ON lt.patient_id = p.id
         WHERE lt.business_id = $1 AND lt.test_status = 'pending'
         GROUP BY dv.id, p.id, p.patient_name, p.national_id
         ORDER BY requested_at ASC`,
        [businessId]
      );

      // Get all individual tests
      const allTests = await pool.query(
        `SELECT lt.*, p.patient_name, p.national_id, p.age, dv.symptoms, dv.disease_diagnosis
         FROM lab_tests lt
         JOIN patients p ON lt.patient_id = p.id
         LEFT JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         WHERE lt.business_id = $1 AND lt.test_status = 'pending'
         ORDER BY lt.test_requested_at ASC`,
        [businessId]
      );

      // Group tests by doctor_visit_id
      const testsByVisit: { [key: number]: any[] } = {};
      allTests.rows.forEach((test: any) => {
        if (!testsByVisit[test.doctor_visit_id]) {
          testsByVisit[test.doctor_visit_id] = [];
        }
        testsByVisit[test.doctor_visit_id].push(test);
      });

      // Combine grouped data with individual tests
      const groupedData = groupedResult.rows.map((group: any) => ({
        ...group,
        tests: testsByVisit[group.doctor_visit_id] || []
      }));

      res.json({
        success: true,
        data: { grouped_lab_tests: groupedData }
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
      const { lab_test_id, test_result, attachment_url, attachment_filename } = req.body;

      if (!lab_test_id || !test_result) {
        res.status(400).json({ success: false, message: 'Lab test ID and result are required' });
        return;
      }

      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE lab_tests SET test_result = $1, test_status = 'completed', test_completed_at = NOW(), 
         lab_technician_id = $2, attachment_url = $3, attachment_filename = $4, updated_at = NOW()
         WHERE id = $5 AND business_id = $6 RETURNING *`,
        [test_result, userId, attachment_url || null, attachment_filename || null, lab_test_id, businessId]
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

  // Get all prescriptions (with optional filters)
  static async getAllPrescriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { status, startDate, endDate, search } = req.query;

      let query = `
        SELECT pr.*, p.patient_name, p.national_id, p.age, dv.disease_diagnosis
        FROM prescriptions pr
        JOIN patients p ON pr.patient_id = p.id
        LEFT JOIN doctor_visits dv ON pr.doctor_visit_id = dv.id
        WHERE pr.business_id = $1
      `;
      const queryParams: any[] = [businessId];
      let paramIndex = 2;

      // Add status filter
      if (status && status !== 'all') {
        query += ` AND pr.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      // Add date range filter
      if (startDate) {
        query += ` AND pr.created_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND pr.created_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      // Add search filter
      if (search) {
        query += ` AND (
          pr.prescription_number ILIKE $${paramIndex} OR 
          p.patient_name ILIKE $${paramIndex} OR 
          p.national_id ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY pr.created_at DESC`;

      const result = await pool.query(query, queryParams);

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

  // Get all patients visited by doctor (with search)
  static async getDoctorPatients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { search } = req.query;

      let query = `
        SELECT DISTINCT
          p.id,
          p.patient_name,
          p.national_id,
          p.age,
          p.location,
          p.phone_number,
          MAX(dv.created_at) as last_visit,
          COUNT(DISTINCT dv.id) as visit_count,
          MAX(dv.disease_diagnosis) as latest_diagnosis
        FROM patients p
        JOIN consultations c ON p.id = c.patient_id
        JOIN doctor_visits dv ON c.id = dv.consultation_id
        WHERE p.business_id = $1
      `;
      const params: any[] = [businessId];

      if (search) {
        query += ` AND (
          p.patient_name ILIKE $2 OR 
          p.national_id ILIKE $2 OR 
          p.phone_number ILIKE $2
        )`;
        params.push(`%${search}%`);
      }

      query += ` 
        GROUP BY p.id, p.patient_name, p.national_id, p.age, p.location, p.phone_number
        ORDER BY last_visit DESC
        LIMIT 100
      `;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: { patients: result.rows }
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark lab test result as viewed/used by doctor
  static async markLabResultViewed(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { lab_test_id } = req.body;

      if (!lab_test_id) {
        res.status(400).json({ success: false, message: 'Lab test ID is required' });
        return;
      }

      // Check if doctor_viewed_at column exists, if not just update updated_at
      try {
        const result = await pool.query(
          `UPDATE lab_tests 
           SET doctor_viewed_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND business_id = $2 AND test_status = 'completed'
           RETURNING *`,
          [lab_test_id, businessId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({ success: false, message: 'Lab test not found or not completed' });
          return;
        }

        res.json({
          success: true,
          message: 'Lab result marked as viewed',
          data: { lab_test: result.rows[0] }
        });
      } catch (colError: any) {
        // If column doesn't exist, just update updated_at
        if (colError.message && colError.message.includes('doctor_viewed_at')) {
          const result = await pool.query(
            `UPDATE lab_tests 
             SET updated_at = NOW()
             WHERE id = $1 AND business_id = $2 AND test_status = 'completed'
             RETURNING *`,
            [lab_test_id, businessId]
          );

          if (result.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Lab test not found or not completed' });
            return;
          }

          res.json({
            success: true,
            message: 'Lab result marked as viewed',
            data: { lab_test: result.rows[0] }
          });
        } else {
          throw colError;
        }
      }
    } catch (error) {
      next(error);
    }
  }

  // Get complete patient consultation history
  static async getPatientConsultationHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { patient_id, national_id } = req.query;

      if (!patient_id && !national_id) {
        res.status(400).json({ success: false, message: 'Patient ID or National ID is required' });
        return;
      }

      // First, get the patient
      let patientQuery = `SELECT * FROM patients WHERE business_id = $1`;
      const patientParams: any[] = [businessId];
      
      if (patient_id) {
        patientQuery += ` AND id = $2`;
        patientParams.push(patient_id);
      } else if (national_id) {
        patientQuery += ` AND national_id = $2`;
        patientParams.push(national_id);
      }

      const patientResult = await pool.query(patientQuery, patientParams);
      
      if (patientResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Patient not found' });
        return;
      }

      const patient = patientResult.rows[0];
      const foundPatientId = patient.id;

      // Get all consultations for this patient
      const consultationsResult = await pool.query(
        `SELECT * FROM consultations 
         WHERE patient_id = $1 AND business_id = $2 
         ORDER BY created_at DESC`,
        [foundPatientId, businessId]
      );

      // Get all doctor visits with their details
      const doctorVisitsResult = await pool.query(
        `SELECT dv.*, c.consultation_number, c.created_at as consultation_date
         FROM doctor_visits dv
         JOIN consultations c ON dv.consultation_id = c.id
         WHERE dv.patient_id = $1 AND dv.business_id = $2
         ORDER BY dv.created_at DESC`,
        [foundPatientId, businessId]
      );

      // Get all lab tests for this patient
      const labTestsResult = await pool.query(
        `SELECT lt.*, dv.consultation_id, c.consultation_number
         FROM lab_tests lt
         LEFT JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         LEFT JOIN consultations c ON dv.consultation_id = c.id
         WHERE lt.patient_id = $1 AND lt.business_id = $2
         ORDER BY lt.test_requested_at DESC`,
        [foundPatientId, businessId]
      );

      // Get all prescriptions for this patient with items
      // Note: prescription_items has item_name, items table has 'name' column
      const prescriptionsResult = await pool.query(
        `SELECT p.*, dv.consultation_id, c.consultation_number,
                (SELECT json_agg(json_build_object(
                  'id', pi.id,
                  'item_id', pi.item_id,
                  'item_name', COALESCE(pi.item_name, i.name, 'Unknown Medicine'),
                  'name', COALESCE(pi.item_name, i.name, 'Unknown Medicine'),
                  'quantity_prescribed', pi.quantity_prescribed,
                  'unit_price', pi.unit_price,
                  'quantity_fulfilled', pi.quantity_fulfilled,
                  'is_available', pi.is_available
                )) FROM prescription_items pi
                LEFT JOIN items i ON pi.item_id = i.id
                WHERE pi.prescription_id = p.id) as items
         FROM prescriptions p
         LEFT JOIN doctor_visits dv ON p.doctor_visit_id = dv.id
         LEFT JOIN consultations c ON dv.consultation_id = c.id
         WHERE p.patient_id = $1 AND p.business_id = $2
         ORDER BY p.created_at DESC`,
        [foundPatientId, businessId]
      );

      // Get the most recent consultation and doctor visit
      const latestConsultation = consultationsResult.rows[0] || null;
      const latestDoctorVisit = doctorVisitsResult.rows[0] || null;

      res.json({
        success: true,
        data: {
          patient,
          latest_consultation: latestConsultation,
          latest_doctor_visit: latestDoctorVisit,
          consultations: consultationsResult.rows,
          doctor_visits: doctorVisitsResult.rows,
          lab_tests: labTestsResult.rows,
          prescriptions: prescriptionsResult.rows
        }
      });
    } catch (error: any) {
      console.error('Error in getPatientConsultationHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch patient consultation history',
        error: error.message
      });
    }
  }

  // Get all lab tests (for lab screen search - pending and completed)
  static async getAllLabTests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { search, status } = req.query;

      let query = `
        SELECT 
          lt.*,
          p.patient_name,
          p.national_id,
          dv.symptoms,
          dv.disease_diagnosis,
          c.consultation_number
        FROM lab_tests lt
        JOIN patients p ON lt.patient_id = p.id
        JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
        JOIN consultations c ON dv.consultation_id = c.id
        WHERE lt.business_id = $1
      `;
      const params: any[] = [businessId];

      if (status && status !== 'all') {
        query += ` AND lt.test_status = $${params.length + 1}`;
        params.push(status);
      }

      if (search) {
        query += ` AND (
          p.patient_name ILIKE $${params.length + 1} OR 
          p.national_id ILIKE $${params.length + 1} OR 
          lt.test_name ILIKE $${params.length + 1} OR
          lt.test_type ILIKE $${params.length + 1}
        )`;
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
      }

      query += ` ORDER BY lt.test_requested_at DESC LIMIT 200`;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: { lab_tests: result.rows }
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ PHARMACY LAB TEST ENDPOINTS ============

  // Get pending lab tests for pharmacy billing
  static async getPendingLabTestsForPharmacy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;

      const result = await pool.query(
        `SELECT lt.*, p.patient_name, p.national_id, p.age, dv.disease_diagnosis, c.consultation_number
         FROM lab_tests lt
         JOIN patients p ON lt.patient_id = p.id
         LEFT JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         LEFT JOIN consultations c ON dv.consultation_id = c.id
         WHERE lt.business_id = $1 AND lt.pharmacy_served = FALSE AND lt.payment_status = 'unpaid'
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

  // Get grouped pending lab tests for pharmacy billing
  static async getGroupedPendingLabTestsForPharmacy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;

      // Get grouped lab tests by doctor_visit_id
      const groupedResult = await pool.query(
        `SELECT 
          dv.id as doctor_visit_id,
          p.id as patient_id,
          p.patient_name,
          p.national_id,
          c.consultation_number,
          MIN(lt.test_requested_at) as requested_at,
          COUNT(lt.id) as test_count,
          SUM(lt.price) as total_amount,
          SUM(lt.amount_due) as total_due
         FROM lab_tests lt
         JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         JOIN patients p ON lt.patient_id = p.id
         LEFT JOIN consultations c ON dv.consultation_id = c.id
         WHERE lt.business_id = $1 AND lt.pharmacy_served = FALSE AND lt.payment_status = 'unpaid'
         GROUP BY dv.id, p.id, p.patient_name, p.national_id, c.consultation_number
         ORDER BY requested_at ASC`,
        [businessId]
      );

      // Get all individual tests
      const allTests = await pool.query(
        `SELECT lt.*, p.patient_name, p.national_id, p.age, dv.disease_diagnosis, c.consultation_number
         FROM lab_tests lt
         JOIN patients p ON lt.patient_id = p.id
         LEFT JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         LEFT JOIN consultations c ON dv.consultation_id = c.id
         WHERE lt.business_id = $1 AND lt.pharmacy_served = FALSE AND lt.payment_status = 'unpaid'
         ORDER BY lt.test_requested_at ASC`,
        [businessId]
      );

      // Group tests by doctor_visit_id
      const testsByVisit: { [key: number]: any[] } = {};
      allTests.rows.forEach((test: any) => {
        if (!testsByVisit[test.doctor_visit_id]) {
          testsByVisit[test.doctor_visit_id] = [];
        }
        testsByVisit[test.doctor_visit_id].push(test);
      });

      // Combine grouped data with individual tests
      const groupedData = groupedResult.rows.map((group: any) => ({
        ...group,
        tests: testsByVisit[group.doctor_visit_id] || []
      }));

      res.json({
        success: true,
        data: { grouped_lab_tests: groupedData }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all lab tests for pharmacy (with filters)
  static async getAllLabTestsForPharmacy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { status, startDate, endDate, search, payment_status } = req.query;

      let query = `
        SELECT lt.*, p.patient_name, p.national_id, p.age, dv.disease_diagnosis, c.consultation_number
        FROM lab_tests lt
        JOIN patients p ON lt.patient_id = p.id
        LEFT JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
        LEFT JOIN consultations c ON dv.consultation_id = c.id
        WHERE lt.business_id = $1
      `;
      const queryParams: any[] = [businessId];
      let paramIndex = 2;

      // Add payment status filter
      if (payment_status && payment_status !== 'all') {
        query += ` AND lt.payment_status = $${paramIndex}`;
        queryParams.push(payment_status);
        paramIndex++;
      }

      // Add test status filter
      if (status && status !== 'all') {
        query += ` AND lt.test_status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      // Add date range filter
      if (startDate) {
        query += ` AND lt.test_requested_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND lt.test_requested_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      // Add search filter
      if (search) {
        query += ` AND (
          lt.test_name ILIKE $${paramIndex} OR 
          p.patient_name ILIKE $${paramIndex} OR 
          p.national_id ILIKE $${paramIndex} OR
          c.consultation_number ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY lt.test_requested_at DESC`;

      const result = await pool.query(query, queryParams);

      res.json({
        success: true,
        data: { lab_tests: result.rows }
      });
    } catch (error) {
      next(error);
    }
  }

  // Bill lab tests (pharmacy billing)
  static async billLabTests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const client = await pool.connect();
    try {
      const businessId = req.businessId!;
      const userId = req.user?.id;
      const { lab_test_ids, amount_paid, financial_account_id } = req.body;
      // lab_test_ids is array of lab test IDs to bill

      if (!lab_test_ids || !Array.isArray(lab_test_ids) || lab_test_ids.length === 0) {
        res.status(400).json({ success: false, message: 'Lab test IDs array is required' });
        return;
      }

      await client.query('BEGIN');

      let totalAmount = 0;
      const billedTests = [];

      // Get all lab tests and calculate total
      for (const testId of lab_test_ids) {
        const test = await client.query(
          `SELECT * FROM lab_tests WHERE id = $1 AND business_id = $2 AND pharmacy_served = FALSE`,
          [testId, businessId]
        );

        if (test.rows.length === 0) continue;

        const labTest = test.rows[0];
        const testPrice = parseFloat(labTest.price || labTest.amount_due || 0);
        totalAmount += testPrice;
        billedTests.push(labTest);
      }

      if (billedTests.length === 0) {
        res.status(404).json({ success: false, message: 'No valid lab tests found to bill' });
        await client.query('ROLLBACK');
        return;
      }

      const paidAmount = parseFloat(amount_paid || totalAmount);
      const paymentStatus = paidAmount >= totalAmount ? 'paid' : (paidAmount > 0 ? 'partially_paid' : 'unpaid');
      
      // Calculate proportional payment per test if partially paid
      const paymentRatio = totalAmount > 0 ? paidAmount / totalAmount : 0;

      // Update all lab tests
      for (const test of billedTests) {
        const testPrice = parseFloat(test.price || test.amount_due || 0);
        const testPaid = paymentRatio * testPrice;
        const testDue = testPrice - testPaid;
        const testPaymentStatus = testPaid >= testPrice ? 'paid' : (testPaid > 0 ? 'partially_paid' : 'unpaid');
        
        await client.query(
          `UPDATE lab_tests SET 
           payment_status = $1, 
           amount_paid = $2, 
           amount_due = $3,
           pharmacy_served = TRUE, 
           served_by = $4, 
           served_at = NOW(), 
           updated_at = NOW() 
           WHERE id = $5`,
          [testPaymentStatus, testPaid, testDue, userId, test.id]
        );
      }

      // Update financial account if provided
      if (financial_account_id && paidAmount > 0) {
        await client.query(
          `UPDATE financial_accounts SET current_balance = current_balance + $1, updated_at = NOW()
           WHERE id = $2 AND business_id = $3`,
          [paidAmount, financial_account_id, businessId]
        );
      }

      await client.query('COMMIT');

      // Get updated lab tests
      const updatedTests = [];
      for (const test of billedTests) {
        const updated = await client.query(`SELECT * FROM lab_tests WHERE id = $1`, [test.id]);
        updatedTests.push(updated.rows[0]);
      }

      res.json({
        success: true,
        message: 'Lab tests billed successfully',
        data: { 
          lab_tests: updatedTests,
          total_amount: totalAmount,
          amount_paid: paidAmount,
          amount_due: totalAmount - paidAmount
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Get lab test analytics grouped by employee
  static async getLabTestAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { startDate, endDate } = req.query;

      let dateFilter = '';
      const params: any[] = [businessId];
      
      if (startDate && endDate) {
        dateFilter = ` AND lt.test_requested_at >= $${params.length + 1} AND lt.test_requested_at <= $${params.length + 2}`;
        params.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = ` AND lt.test_requested_at >= $${params.length + 1}`;
        params.push(startDate);
      } else if (endDate) {
        dateFilter = ` AND lt.test_requested_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      // Get analytics grouped by doctor (who requested the tests)
      const doctorAnalytics = await pool.query(
        `SELECT 
          u.id as employee_id,
          u.first_name || ' ' || u.last_name as employee_name,
          u.email as employee_email,
          COUNT(DISTINCT lt.id) as total_tests,
          COUNT(DISTINCT lt.patient_id) as total_patients,
          SUM(lt.price) as total_amount,
          SUM(lt.amount_paid) as total_paid,
          SUM(lt.amount_due) as total_due,
          COUNT(DISTINCT CASE WHEN lt.payment_status = 'paid' THEN lt.id END) as paid_tests,
          COUNT(DISTINCT CASE WHEN lt.payment_status = 'unpaid' THEN lt.id END) as unpaid_tests,
          COUNT(DISTINCT CASE WHEN lt.test_status = 'completed' THEN lt.id END) as completed_tests,
          COUNT(DISTINCT CASE WHEN lt.test_status = 'pending' THEN lt.id END) as pending_tests
         FROM lab_tests lt
         JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         LEFT JOIN users u ON dv.doctor_id = u.id
         WHERE lt.business_id = $1 ${dateFilter}
         GROUP BY u.id, u.first_name, u.last_name, u.email
         ORDER BY total_tests DESC`,
        params
      );

      // Get overall totals
      const overallTotals = await pool.query(
        `SELECT 
          COUNT(DISTINCT lt.id) as total_tests,
          COUNT(DISTINCT lt.patient_id) as total_patients,
          COUNT(DISTINCT dv.doctor_id) as total_doctors,
          SUM(lt.price) as total_amount,
          SUM(lt.amount_paid) as total_paid,
          SUM(lt.amount_due) as total_due,
          COUNT(DISTINCT CASE WHEN lt.payment_status = 'paid' THEN lt.id END) as paid_tests,
          COUNT(DISTINCT CASE WHEN lt.payment_status = 'unpaid' THEN lt.id END) as unpaid_tests,
          COUNT(DISTINCT CASE WHEN lt.test_status = 'completed' THEN lt.id END) as completed_tests,
          COUNT(DISTINCT CASE WHEN lt.test_status = 'pending' THEN lt.id END) as pending_tests
         FROM lab_tests lt
         JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         WHERE lt.business_id = $1 ${dateFilter}`,
        params
      );

      // Get detailed tests for each employee
      const detailedTests = await pool.query(
        `SELECT 
          lt.*,
          dv.doctor_id,
          u.first_name || ' ' || u.last_name as doctor_name,
          p.patient_name,
          p.national_id,
          c.consultation_number
         FROM lab_tests lt
         JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
         LEFT JOIN users u ON dv.doctor_id = u.id
         JOIN patients p ON lt.patient_id = p.id
         LEFT JOIN consultations c ON dv.consultation_id = c.id
         WHERE lt.business_id = $1 ${dateFilter}
         ORDER BY lt.test_requested_at DESC`,
        params
      );

      // Group detailed tests by employee
      const testsByEmployee: { [key: number]: any[] } = {};
      if (detailedTests.rows && Array.isArray(detailedTests.rows)) {
        detailedTests.rows.forEach((test: any) => {
          const empId = test.doctor_id || 0;
          if (!testsByEmployee[empId]) {
            testsByEmployee[empId] = [];
          }
          testsByEmployee[empId].push(test);
        });
      }

      // Combine analytics with detailed tests
      const analyticsWithDetails = (doctorAnalytics.rows || []).map((emp: any) => ({
        ...emp,
        employee_id: emp.employee_id || 0,
        employee_name: emp.employee_name || 'Unknown',
        employee_email: emp.employee_email || '',
        total_tests: parseInt(emp.total_tests) || 0,
        total_patients: parseInt(emp.total_patients) || 0,
        total_amount: parseFloat(emp.total_amount) || 0,
        total_paid: parseFloat(emp.total_paid) || 0,
        total_due: parseFloat(emp.total_due) || 0,
        paid_tests: parseInt(emp.paid_tests) || 0,
        unpaid_tests: parseInt(emp.unpaid_tests) || 0,
        completed_tests: parseInt(emp.completed_tests) || 0,
        pending_tests: parseInt(emp.pending_tests) || 0,
        tests: testsByEmployee[emp.employee_id || 0] || []
      }));

      // Ensure overall totals has all required fields
      const totals = overallTotals.rows[0] || {};
      const safeTotals = {
        total_tests: parseInt(totals.total_tests) || 0,
        total_patients: parseInt(totals.total_patients) || 0,
        total_doctors: parseInt(totals.total_doctors) || 0,
        total_amount: parseFloat(totals.total_amount) || 0,
        total_paid: parseFloat(totals.total_paid) || 0,
        total_due: parseFloat(totals.total_due) || 0,
        paid_tests: parseInt(totals.paid_tests) || 0,
        unpaid_tests: parseInt(totals.unpaid_tests) || 0,
        completed_tests: parseInt(totals.completed_tests) || 0,
        pending_tests: parseInt(totals.pending_tests) || 0,
      };

      res.json({
        success: true,
        data: {
          employees: analyticsWithDetails,
          overall_totals: safeTotals,
          date_range: {
            start_date: startDate || null,
            end_date: endDate || null
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get hospital analytics (patient-wise summary)
  static async getHospitalAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId!;
      const { startDate, endDate } = req.query;

      let dateFilter = '';
      const params: any[] = [businessId];
      
      if (startDate && endDate) {
        dateFilter = ` AND c.created_at >= $${params.length + 1} AND c.created_at <= $${params.length + 2}`;
        params.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = ` AND c.created_at >= $${params.length + 1}`;
        params.push(startDate);
      } else if (endDate) {
        dateFilter = ` AND c.created_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      // Get all consultations with patient and doctor info
      const consultationsQuery = `
        SELECT 
          c.id as consultation_id,
          c.consultation_number,
          c.consultation_fee,
          c.created_at as consultation_date,
          p.id as patient_id,
          p.patient_name,
          p.national_id,
          dv.id as doctor_visit_id,
          dv.symptoms,
          dv.disease_diagnosis,
          dv.other_analysis,
          dv.blood_pressure,
          dv.temperature,
          dv.heart_rate,
          dv.notes,
          u.id as doctor_id,
          u.first_name || ' ' || u.last_name as doctor_name,
          u.email as doctor_email
        FROM consultations c
        JOIN patients p ON c.patient_id = p.id
        LEFT JOIN doctor_visits dv ON c.id = dv.consultation_id
        LEFT JOIN users u ON dv.doctor_id = u.id
        WHERE c.business_id = $1 ${dateFilter}
        ORDER BY c.created_at DESC
      `;

      const consultations = await pool.query(consultationsQuery, params);

      // Get lab tests for these consultations
      const labTestsQuery = `
        SELECT 
          lt.id,
          lt.doctor_visit_id,
          lt.patient_id,
          lt.test_name,
          lt.test_type,
          lt.category,
          lt.others,
          lt.price,
          lt.amount_paid,
          lt.amount_due,
          lt.payment_status,
          lt.test_status,
          lt.test_requested_at,
          dv.consultation_id
        FROM lab_tests lt
        JOIN doctor_visits dv ON lt.doctor_visit_id = dv.id
        JOIN consultations c ON dv.consultation_id = c.id
        WHERE c.business_id = $1 ${dateFilter}
      `;

      const labTests = await pool.query(labTestsQuery, params);

      // Get prescriptions for these consultations
      const prescriptionsQuery = `
        SELECT 
          pr.id,
          pr.doctor_visit_id,
          pr.patient_id,
          pr.prescription_number,
          pr.total_amount,
          pr.amount_paid,
          pr.status,
          pr.created_at,
          dv.consultation_id
        FROM prescriptions pr
        JOIN doctor_visits dv ON pr.doctor_visit_id = dv.id
        JOIN consultations c ON dv.consultation_id = c.id
        WHERE c.business_id = $1 ${dateFilter}
      `;

      const prescriptions = await pool.query(prescriptionsQuery, params);

      // Group data by consultation
      const analyticsByConsultation: any[] = consultations.rows.map((consultation: any) => {
        const consultationId = consultation.consultation_id;
        const patientId = consultation.patient_id;
        const doctorVisitId = consultation.doctor_visit_id;

        // Get lab tests for this consultation
        const consultationLabTests = labTests.rows.filter((lt: any) => 
          lt.consultation_id === consultationId
        );

        // Get prescriptions for this consultation
        const consultationPrescriptions = prescriptions.rows.filter((pr: any) => 
          pr.consultation_id === consultationId
        );

        // Calculate totals
        const labTestAmountPaid = consultationLabTests.reduce((sum: number, lt: any) => 
          sum + parseFloat(lt.amount_paid || 0), 0
        );
        const prescriptionAmountPaid = consultationPrescriptions.reduce((sum: number, pr: any) => 
          sum + parseFloat(pr.amount_paid || 0), 0
        );
        const totalAmount = parseFloat(consultation.consultation_fee || 0) + 
                           consultationLabTests.reduce((sum: number, lt: any) => sum + parseFloat(lt.price || 0), 0) +
                           consultationPrescriptions.reduce((sum: number, pr: any) => sum + parseFloat(pr.total_amount || 0), 0);

        return {
          consultation_id: consultationId,
          consultation_number: consultation.consultation_number,
          consultation_date: consultation.consultation_date,
          patient_id: patientId,
          patient_name: consultation.patient_name,
          national_id: consultation.national_id,
          doctor_id: consultation.doctor_id,
          doctor_name: consultation.doctor_name || 'N/A',
          doctor_email: consultation.doctor_email || 'N/A',
          consultation_fee: parseFloat(consultation.consultation_fee || 0),
          diagnosis: {
            symptoms: consultation.symptoms || '',
            disease_diagnosis: consultation.disease_diagnosis || '',
            other_analysis: consultation.other_analysis || '',
            blood_pressure: consultation.blood_pressure || '',
            temperature: consultation.temperature || '',
            heart_rate: consultation.heart_rate || '',
            notes: consultation.notes || '',
          },
          lab_tests: consultationLabTests.map((lt: any) => ({
            id: lt.id,
            test_name: lt.test_name,
            test_type: lt.test_type,
            category: lt.category,
            others: lt.others,
            price: parseFloat(lt.price || 0),
            amount_paid: parseFloat(lt.amount_paid || 0),
            payment_status: lt.payment_status,
            test_status: lt.test_status,
            test_requested_at: lt.test_requested_at,
          })),
          lab_test_amount_paid: labTestAmountPaid,
          prescription_amount_paid: prescriptionAmountPaid,
          total_amount: totalAmount,
        };
      });

      // Calculate overall totals
      const overallTotals = {
        total_consultation_fees: consultations.rows.reduce((sum: number, c: any) => 
          sum + parseFloat(c.consultation_fee || 0), 0
        ),
        total_lab_test_amount: labTests.rows.reduce((sum: number, lt: any) => 
          sum + parseFloat(lt.price || 0), 0
        ),
        total_lab_test_paid: labTests.rows.reduce((sum: number, lt: any) => 
          sum + parseFloat(lt.amount_paid || 0), 0
        ),
        total_prescription_amount: prescriptions.rows.reduce((sum: number, pr: any) => 
          sum + parseFloat(pr.total_amount || 0), 0
        ),
        total_prescription_paid: prescriptions.rows.reduce((sum: number, pr: any) => 
          sum + parseFloat(pr.amount_paid || 0), 0
        ),
        grand_total: consultations.rows.reduce((sum: number, c: any) => 
          sum + parseFloat(c.consultation_fee || 0), 0
        ) + labTests.rows.reduce((sum: number, lt: any) => 
          sum + parseFloat(lt.price || 0), 0
        ) + prescriptions.rows.reduce((sum: number, pr: any) => 
          sum + parseFloat(pr.total_amount || 0), 0
        ),
      };

      res.json({
        success: true,
        data: {
          consultations: analyticsByConsultation,
          overall_totals: overallTotals,
          date_range: {
            start_date: startDate || null,
            end_date: endDate || null
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

