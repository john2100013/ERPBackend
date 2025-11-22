-- Hospital Management Module Migration
-- This creates all tables needed for the hospital management system

-- 1. Patients table
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) UNIQUE,
    location VARCHAR(255),
    age INTEGER,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    is_first_visit BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Consultations (Receptionist entries)
CREATE TABLE IF NOT EXISTS consultations (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    consultation_number VARCHAR(50) UNIQUE NOT NULL,
    consultation_fee DECIMAL(10, 2) DEFAULT 0,
    receipt_generated BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Doctor Visits (Doctor consultations)
CREATE TABLE IF NOT EXISTS doctor_visits (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    symptoms TEXT,
    blood_pressure VARCHAR(20),
    temperature DECIMAL(5, 2),
    heart_rate INTEGER,
    other_analysis TEXT,
    disease_diagnosis VARCHAR(255),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'waiting_lab', 'completed', 'cancelled')),
    lab_test_required BOOLEAN DEFAULT FALSE,
    doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Lab Tests (Test requests and results)
CREATE TABLE IF NOT EXISTS lab_tests (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    doctor_visit_id INTEGER NOT NULL REFERENCES doctor_visits(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100),
    test_requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    test_completed_at TIMESTAMP,
    test_result TEXT,
    test_status VARCHAR(20) DEFAULT 'pending' CHECK (test_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    lab_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Prescriptions (Doctor prescriptions)
CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    doctor_visit_id INTEGER NOT NULL REFERENCES doctor_visits(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    prescription_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partially_fulfilled', 'fulfilled', 'cancelled')),
    total_amount DECIMAL(10, 2) DEFAULT 0,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    pharmacy_served BOOLEAN DEFAULT FALSE,
    served_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    served_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Prescription Items (Individual medicines in a prescription)
CREATE TABLE IF NOT EXISTS prescription_items (
    id SERIAL PRIMARY KEY,
    prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity_prescribed DECIMAL(10, 2) NOT NULL,
    quantity_available DECIMAL(10, 2) DEFAULT 0,
    quantity_fulfilled DECIMAL(10, 2) DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    is_missing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_business ON patients(business_id);
CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);
CREATE INDEX IF NOT EXISTS idx_consultations_business ON consultations(business_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_number ON consultations(consultation_number);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_business ON doctor_visits(business_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_consultation ON doctor_visits(consultation_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_patient ON doctor_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_status ON doctor_visits(status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_business ON lab_tests(business_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_doctor_visit ON lab_tests(doctor_visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_status ON lab_tests(test_status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_business ON prescriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_visit ON prescriptions(doctor_visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);
CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_item ON prescription_items(item_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hospital_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_patients_timestamp ON patients;
CREATE TRIGGER update_patients_timestamp BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_hospital_updated_at();

DROP TRIGGER IF EXISTS update_consultations_timestamp ON consultations;
CREATE TRIGGER update_consultations_timestamp BEFORE UPDATE ON consultations
    FOR EACH ROW EXECUTE FUNCTION update_hospital_updated_at();

DROP TRIGGER IF EXISTS update_doctor_visits_timestamp ON doctor_visits;
CREATE TRIGGER update_doctor_visits_timestamp BEFORE UPDATE ON doctor_visits
    FOR EACH ROW EXECUTE FUNCTION update_hospital_updated_at();

DROP TRIGGER IF EXISTS update_lab_tests_timestamp ON lab_tests;
CREATE TRIGGER update_lab_tests_timestamp BEFORE UPDATE ON lab_tests
    FOR EACH ROW EXECUTE FUNCTION update_hospital_updated_at();

DROP TRIGGER IF EXISTS update_prescriptions_timestamp ON prescriptions;
CREATE TRIGGER update_prescriptions_timestamp BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_hospital_updated_at();

DROP TRIGGER IF EXISTS update_prescription_items_timestamp ON prescription_items;
CREATE TRIGGER update_prescription_items_timestamp BEFORE UPDATE ON prescription_items
    FOR EACH ROW EXECUTE FUNCTION update_hospital_updated_at();

