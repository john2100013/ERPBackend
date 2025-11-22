import { Router } from 'express';
import { HospitalController } from '../controllers/hospitalController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ============ RECEPTIONIST ROUTES ============
// Create or get patient
router.post('/patients', authenticateToken, HospitalController.createOrGetPatient);

// Create consultation
router.post('/consultations', authenticateToken, HospitalController.createConsultation);

// Get pending consultations (for doctor)
router.get('/consultations/pending', authenticateToken, HospitalController.getPendingConsultations);

// ============ DOCTOR ROUTES ============
// Get doctor visit by consultation ID
router.get('/doctor-visits', authenticateToken, HospitalController.getDoctorVisitByConsultation);

// Create or update doctor visit
router.post('/doctor-visits', authenticateToken, HospitalController.createOrUpdateDoctorVisit);

// Request lab tests
router.post('/lab-tests/request', authenticateToken, HospitalController.requestLabTests);

// Create prescription
router.post('/prescriptions', authenticateToken, HospitalController.createPrescription);

// Get lab test results
router.get('/lab-tests/results', authenticateToken, HospitalController.getLabTestResults);

// ============ LAB ROUTES ============
// Get pending lab tests
router.get('/lab-tests/pending', authenticateToken, HospitalController.getPendingLabTests);

// Update lab test result
router.put('/lab-tests/:id/result', authenticateToken, HospitalController.updateLabTestResult);

// ============ PHARMACY ROUTES ============
// Get pending prescriptions
router.get('/prescriptions/pending', authenticateToken, HospitalController.getPendingPrescriptions);

// Get prescription items
router.get('/prescriptions/:id/items', authenticateToken, HospitalController.getPrescriptionItems);

// Fulfill prescription
router.post('/prescriptions/:id/fulfill', authenticateToken, HospitalController.fulfillPrescription);

export default router;

