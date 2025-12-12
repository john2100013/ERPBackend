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

// Mark lab result as viewed
router.post('/lab-tests/mark-viewed', authenticateToken, HospitalController.markLabResultViewed);

// Get all patients visited by doctor (with search)
router.get('/doctor/patients', authenticateToken, HospitalController.getDoctorPatients);

// Get complete patient consultation history
router.get('/patient/history', authenticateToken, HospitalController.getPatientConsultationHistory);

// ============ LAB ROUTES ============
// Get pending lab tests
router.get('/lab-tests/pending', authenticateToken, HospitalController.getPendingLabTests);

// Get all lab tests (with search)
router.get('/lab-tests/all', authenticateToken, HospitalController.getAllLabTests);

// Update lab test result
router.put('/lab-tests/:id/result', authenticateToken, HospitalController.updateLabTestResult);

// ============ PHARMACY ROUTES ============
// IMPORTANT: More specific routes must come before general routes
// Get pending prescriptions (specific route - must come first)
router.get('/prescriptions/pending', authenticateToken, HospitalController.getPendingPrescriptions);

// Get prescription items (specific route with /items - must come before /prescriptions)
router.get('/prescriptions/:id/items', authenticateToken, HospitalController.getPrescriptionItems);

// Fulfill prescription (specific route with /fulfill - must come before /prescriptions)
router.post('/prescriptions/:id/fulfill', authenticateToken, HospitalController.fulfillPrescription);

// Get all prescriptions (general route - must come last)
router.get('/prescriptions', authenticateToken, HospitalController.getAllPrescriptions);

export default router;

