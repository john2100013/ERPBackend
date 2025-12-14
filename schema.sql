-- Neon Database Schema Dump
-- Generated: 2025-12-14T09:18:54.203Z
-- Total Tables: 42


-- Table: booking_services
CREATE TABLE IF NOT EXISTS booking_services (
  id INTEGER NOT NULL DEFAULT nextval('booking_services_id_seq',
  booking_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  employee_id INTEGER,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  estimated_duration INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE booking_services ADD CONSTRAINT booking_services_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE booking_services ADD CONSTRAINT booking_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);
ALTER TABLE booking_services ADD CONSTRAINT booking_services_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_employee ON booking_services(employee_id);


-- Table: bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER NOT NULL DEFAULT nextval('bookings_id_seq',
  business_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME WITHOUT TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE bookings ADD CONSTRAINT bookings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES service_customers(id);

CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);


-- Table: business_custom_category_names
CREATE TABLE IF NOT EXISTS business_custom_category_names (
  id INTEGER NOT NULL DEFAULT nextval('business_custom_category_names_id_seq',
  business_id INTEGER NOT NULL,
  category_1_name VARCHAR(100) DEFAULT 'Category 1',
  category_2_name VARCHAR(100) DEFAULT 'Category 2',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE business_custom_category_names ADD CONSTRAINT business_custom_category_names_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE UNIQUE INDEX IF NOT EXISTS business_custom_category_names_business_id_key ON business_custom_category_names(business_id);
CREATE INDEX IF NOT EXISTS idx_business_custom_category_names_business_id ON business_custom_category_names(business_id);


-- Table: business_settings
CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER NOT NULL DEFAULT nextval('business_settings_id_seq',
  business_id INTEGER NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  street VARCHAR(255),
  city VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(50) NOT NULL,
  created_by VARCHAR(255),
  approved_by VARCHAR(255),
  created_by_signature TEXT,
  approved_by_signature TEXT,
  logo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS business_settings_business_id_key ON business_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_business_settings_business_id ON business_settings(business_id);


-- Table: businesses
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER NOT NULL DEFAULT nextval('businesses_id_seq',
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name);


-- Table: commission_settings
CREATE TABLE IF NOT EXISTS commission_settings (
  id INTEGER NOT NULL DEFAULT nextval('commission_settings_id_seq',
  business_id INTEGER NOT NULL,
  min_customers INTEGER NOT NULL DEFAULT 10,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE commission_settings ADD CONSTRAINT commission_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE UNIQUE INDEX IF NOT EXISTS commission_settings_business_id_key ON commission_settings(business_id);


-- Table: consultations
CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER NOT NULL DEFAULT nextval('consultations_id_seq',
  business_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  consultation_number VARCHAR(50) NOT NULL,
  consultation_fee NUMERIC(10, 2) DEFAULT 0,
  receipt_generated BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending',
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE consultations ADD CONSTRAINT consultations_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE consultations ADD CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE consultations ADD CONSTRAINT consultations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS consultations_consultation_number_key ON consultations(consultation_number);
CREATE INDEX IF NOT EXISTS idx_consultations_business ON consultations(business_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_number ON consultations(consultation_number);


-- Table: customer_assignments
CREATE TABLE IF NOT EXISTS customer_assignments (
  id INTEGER NOT NULL DEFAULT nextval('customer_assignments_id_seq',
  business_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  booking_id INTEGER,
  service_id INTEGER NOT NULL,
  assignment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  estimated_duration INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE customer_assignments ADD CONSTRAINT customer_assignments_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE customer_assignments ADD CONSTRAINT customer_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES service_customers(id);
ALTER TABLE customer_assignments ADD CONSTRAINT customer_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE customer_assignments ADD CONSTRAINT customer_assignments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE customer_assignments ADD CONSTRAINT customer_assignments_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);

CREATE INDEX IF NOT EXISTS idx_customer_assignments_business ON customer_assignments(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_customer ON customer_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_employee ON customer_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_status ON customer_assignments(status);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_booking ON customer_assignments(booking_id);


-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER NOT NULL DEFAULT nextval('customers_id_seq',
  business_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pin VARCHAR(50),
  location TEXT,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_pin ON customers(pin);


-- Table: damage_record_lines
CREATE TABLE IF NOT EXISTS damage_record_lines (
  id INTEGER NOT NULL DEFAULT nextval('damage_record_lines_id_seq',
  damage_record_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity NUMERIC(10, 3) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  code VARCHAR(100) NOT NULL,
  uom VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE damage_record_lines ADD CONSTRAINT damage_record_lines_damage_record_id_fkey FOREIGN KEY (damage_record_id) REFERENCES damage_records(id);
ALTER TABLE damage_record_lines ADD CONSTRAINT damage_record_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id);

CREATE INDEX IF NOT EXISTS idx_damage_record_lines_damage_record_id ON damage_record_lines(damage_record_id);
CREATE INDEX IF NOT EXISTS idx_damage_record_lines_item_id ON damage_record_lines(item_id);


-- Table: damage_records
CREATE TABLE IF NOT EXISTS damage_records (
  id INTEGER NOT NULL DEFAULT nextval('damage_records_id_seq',
  business_id INTEGER NOT NULL,
  damage_number VARCHAR(50) NOT NULL,
  damage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  damage_type VARCHAR(20) NOT NULL,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS damage_records_damage_number_key ON damage_records(damage_number);
CREATE INDEX IF NOT EXISTS idx_damage_records_business_id ON damage_records(business_id);
CREATE INDEX IF NOT EXISTS idx_damage_records_damage_type ON damage_records(damage_type);
CREATE INDEX IF NOT EXISTS idx_damage_records_status ON damage_records(status);
CREATE INDEX IF NOT EXISTS idx_damage_records_damage_number ON damage_records(damage_number);


-- Table: doctor_visits
CREATE TABLE IF NOT EXISTS doctor_visits (
  id INTEGER NOT NULL DEFAULT nextval('doctor_visits_id_seq',
  business_id INTEGER NOT NULL,
  consultation_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  symptoms TEXT,
  blood_pressure VARCHAR(20),
  temperature NUMERIC(5, 2),
  heart_rate INTEGER,
  other_analysis TEXT,
  disease_diagnosis VARCHAR(255),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  lab_test_required BOOLEAN DEFAULT false,
  doctor_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE doctor_visits ADD CONSTRAINT doctor_visits_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE doctor_visits ADD CONSTRAINT doctor_visits_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES consultations(id);
ALTER TABLE doctor_visits ADD CONSTRAINT doctor_visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE doctor_visits ADD CONSTRAINT doctor_visits_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_doctor_visits_business ON doctor_visits(business_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_consultation ON doctor_visits(consultation_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_patient ON doctor_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_status ON doctor_visits(status);


-- Table: employee_commissions
CREATE TABLE IF NOT EXISTS employee_commissions (
  id INTEGER NOT NULL DEFAULT nextval('employee_commissions_id_seq',
  business_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_customers INTEGER NOT NULL,
  total_revenue NUMERIC(10, 2) NOT NULL,
  commission_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE employee_commissions ADD CONSTRAINT employee_commissions_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE employee_commissions ADD CONSTRAINT employee_commissions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);

CREATE INDEX IF NOT EXISTS idx_employee_commissions_employee ON employee_commissions(employee_id);


-- Table: employees
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER NOT NULL DEFAULT nextval('employees_id_seq',
  business_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  position VARCHAR(100),
  commission_rate NUMERIC(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE employees ADD CONSTRAINT employees_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE INDEX IF NOT EXISTS idx_employees_business ON employees(business_id);


-- Table: financial_accounts
CREATE TABLE IF NOT EXISTS financial_accounts (
  id INTEGER NOT NULL DEFAULT nextval('financial_accounts_id_seq',
  business_id INTEGER NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  account_number VARCHAR(100),
  bank_name VARCHAR(255),
  opening_balance NUMERIC(12, 2) DEFAULT 0,
  current_balance NUMERIC(12, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_business_id ON financial_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON financial_accounts(account_type);


-- Table: goods_return_lines
CREATE TABLE IF NOT EXISTS goods_return_lines (
  id INTEGER NOT NULL DEFAULT nextval('goods_return_lines_id_seq',
  return_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity NUMERIC(10, 3) NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  code VARCHAR(100) NOT NULL,
  uom VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE goods_return_lines ADD CONSTRAINT goods_return_lines_return_id_fkey FOREIGN KEY (return_id) REFERENCES goods_returns(id);
ALTER TABLE goods_return_lines ADD CONSTRAINT goods_return_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id);

CREATE INDEX IF NOT EXISTS idx_goods_return_lines_return_id ON goods_return_lines(return_id);
CREATE INDEX IF NOT EXISTS idx_goods_return_lines_item_id ON goods_return_lines(item_id);


-- Table: goods_returns
CREATE TABLE IF NOT EXISTS goods_returns (
  id INTEGER NOT NULL DEFAULT nextval('goods_returns_id_seq',
  business_id INTEGER NOT NULL,
  return_number VARCHAR(50) NOT NULL,
  invoice_id INTEGER,
  customer_name VARCHAR(255) NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(12, 2) DEFAULT 0,
  refund_method VARCHAR(50),
  financial_account_id INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE goods_returns ADD CONSTRAINT goods_returns_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE goods_returns ADD CONSTRAINT goods_returns_financial_account_id_fkey FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id);

CREATE UNIQUE INDEX IF NOT EXISTS goods_returns_return_number_key ON goods_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_goods_returns_business_id ON goods_returns(business_id);
CREATE INDEX IF NOT EXISTS idx_goods_returns_invoice_id ON goods_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_goods_returns_return_number ON goods_returns(return_number);


-- Table: invoice_lines
CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER NOT NULL DEFAULT nextval('invoice_items_id_seq',
  invoice_id INTEGER NOT NULL,
  item_id INTEGER,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  code VARCHAR(100),
  uom VARCHAR(50),
  category_id INTEGER,
  category_1_id INTEGER,
  category_2_id INTEGER,
  category_name VARCHAR(255),
  category_1_name VARCHAR(255),
  category_2_name VARCHAR(255),
  PRIMARY KEY (id)
);

ALTER TABLE invoice_lines ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id);
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES item_categories(id);
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_category_1_id_fkey FOREIGN KEY (category_1_id) REFERENCES item_categories(id);
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_category_2_id_fkey FOREIGN KEY (category_2_id) REFERENCES item_categories(id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_id ON invoice_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_category_id ON invoice_lines(category_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_category_1_id ON invoice_lines(category_1_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_category_2_id ON invoice_lines(category_2_id);


-- Table: invoice_payments
CREATE TABLE IF NOT EXISTS invoice_payments (
  id INTEGER NOT NULL DEFAULT nextval('invoice_payments_id_seq',
  business_id INTEGER NOT NULL,
  invoice_id INTEGER NOT NULL,
  financial_account_id INTEGER NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_reference VARCHAR(255),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id);
ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_financial_account_id_fkey FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_financial_account_id ON invoice_payments(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_business_id ON invoice_payments(business_id);


-- Table: invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER NOT NULL DEFAULT nextval('invoices_id_seq',
  business_id INTEGER NOT NULL,
  customer_id INTEGER,
  invoice_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  customer_name VARCHAR(255),
  customer_address TEXT,
  customer_pin VARCHAR(50),
  quotation_id INTEGER,
  payment_terms VARCHAR(255) DEFAULT 'Net 30 Days',
  created_by INTEGER,
  amount_paid NUMERIC(12, 2) DEFAULT 0,
  balance_due NUMERIC(12, 2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  payment_method VARCHAR(50) DEFAULT 'Cash',
  mpesa_code VARCHAR(100),
  PRIMARY KEY (id)
);

ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_business_id_invoice_number_key ON invoices(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_business_id_invoice_number_key ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);


-- Table: item_categories
CREATE TABLE IF NOT EXISTS item_categories (
  id INTEGER NOT NULL DEFAULT nextval('item_categories_id_seq',
  business_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE item_categories ADD CONSTRAINT item_categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE UNIQUE INDEX IF NOT EXISTS item_categories_business_id_name_key ON item_categories(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS item_categories_business_id_name_key ON item_categories(name);
CREATE INDEX IF NOT EXISTS idx_item_categories_business_id ON item_categories(business_id);


-- Table: items
CREATE TABLE IF NOT EXISTS items (
  id INTEGER NOT NULL DEFAULT nextval('items_id_seq',
  business_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  buying_price NUMERIC(12, 2) DEFAULT 0,
  selling_price NUMERIC(12, 2) DEFAULT 0,
  category_id INTEGER,
  manufacturing_date DATE,
  expiry_date DATE,
  reorder_level INTEGER DEFAULT 10,
  cost_price NUMERIC(10, 2) DEFAULT 0,
  category_1_id INTEGER,
  category_2_id INTEGER,
  PRIMARY KEY (id)
);

ALTER TABLE items ADD CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id) REFERENCES item_categories(id);
ALTER TABLE items ADD CONSTRAINT items_category_1_id_fkey FOREIGN KEY (category_1_id) REFERENCES item_categories(id);
ALTER TABLE items ADD CONSTRAINT items_category_2_id_fkey FOREIGN KEY (category_2_id) REFERENCES item_categories(id);

CREATE INDEX IF NOT EXISTS idx_items_business_id ON items(business_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_category_1_id ON items(category_1_id);
CREATE INDEX IF NOT EXISTS idx_items_category_2_id ON items(category_2_id);


-- Table: lab_tests
CREATE TABLE IF NOT EXISTS lab_tests (
  id INTEGER NOT NULL DEFAULT nextval('lab_tests_id_seq',
  business_id INTEGER NOT NULL,
  doctor_visit_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  test_type VARCHAR(100),
  test_requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  test_completed_at TIMESTAMP,
  test_result TEXT,
  test_status VARCHAR(20) DEFAULT 'pending',
  lab_technician_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attachment_url TEXT,
  attachment_filename VARCHAR(255),
  category VARCHAR(100),
  others TEXT,
  price NUMERIC(10, 2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  amount_due NUMERIC(10, 2) DEFAULT 0,
  amount_paid NUMERIC(10, 2) DEFAULT 0,
  pharmacy_served BOOLEAN DEFAULT false,
  served_by INTEGER,
  served_at TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE lab_tests ADD CONSTRAINT lab_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE lab_tests ADD CONSTRAINT lab_tests_lab_technician_id_fkey FOREIGN KEY (lab_technician_id) REFERENCES users(id);
ALTER TABLE lab_tests ADD CONSTRAINT lab_tests_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE lab_tests ADD CONSTRAINT lab_tests_doctor_visit_id_fkey FOREIGN KEY (doctor_visit_id) REFERENCES doctor_visits(id);
ALTER TABLE lab_tests ADD CONSTRAINT lab_tests_served_by_fkey FOREIGN KEY (served_by) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_lab_tests_business ON lab_tests(business_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_doctor_visit ON lab_tests(doctor_visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_status ON lab_tests(test_status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_payment_status ON lab_tests(payment_status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_pharmacy_served ON lab_tests(pharmacy_served);


-- Table: mpesa_confirmations
CREATE TABLE IF NOT EXISTS mpesa_confirmations (
  id INTEGER NOT NULL DEFAULT nextval('mpesa_confirmations_id_seq',
  business_id INTEGER NOT NULL,
  transaction_type VARCHAR(50),
  trans_id VARCHAR(100) NOT NULL,
  trans_time VARCHAR(50),
  trans_amount NUMERIC(15, 2),
  business_short_code VARCHAR(50),
  bill_ref_number VARCHAR(100),
  invoice_number VARCHAR(100),
  org_account_balance NUMERIC(15, 2),
  third_party_trans_id VARCHAR(100),
  msisdn VARCHAR(20),
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  result_code INTEGER,
  result_desc VARCHAR(255),
  linked_invoice_id INTEGER,
  linked_at TIMESTAMP,
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE mpesa_confirmations ADD CONSTRAINT mpesa_confirmations_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE mpesa_confirmations ADD CONSTRAINT mpesa_confirmations_linked_invoice_id_fkey FOREIGN KEY (linked_invoice_id) REFERENCES invoices(id);

CREATE UNIQUE INDEX IF NOT EXISTS mpesa_confirmations_trans_id_key ON mpesa_confirmations(trans_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_business_id ON mpesa_confirmations(business_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_trans_id ON mpesa_confirmations(trans_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_linked_invoice_id ON mpesa_confirmations(linked_invoice_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_is_processed ON mpesa_confirmations(is_processed);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_created_at ON mpesa_confirmations(created_at);


-- Table: patients
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER NOT NULL DEFAULT nextval('patients_id_seq',
  business_id INTEGER NOT NULL,
  patient_name VARCHAR(255) NOT NULL,
  national_id VARCHAR(50),
  location VARCHAR(255),
  age INTEGER,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  is_first_visit BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE patients ADD CONSTRAINT patients_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE UNIQUE INDEX IF NOT EXISTS patients_national_id_key ON patients(national_id);
CREATE INDEX IF NOT EXISTS idx_patients_business ON patients(business_id);
CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);


-- Table: prescription_items
CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER NOT NULL DEFAULT nextval('prescription_items_id_seq',
  prescription_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity_prescribed NUMERIC(10, 2) NOT NULL,
  quantity_available NUMERIC(10, 2) DEFAULT 0,
  quantity_fulfilled NUMERIC(10, 2) DEFAULT 0,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  is_available BOOLEAN DEFAULT true,
  is_missing BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id);
ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_item ON prescription_items(item_id);


-- Table: prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER NOT NULL DEFAULT nextval('prescriptions_id_seq',
  business_id INTEGER NOT NULL,
  doctor_visit_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  prescription_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_amount NUMERIC(10, 2) DEFAULT 0,
  amount_paid NUMERIC(10, 2) DEFAULT 0,
  pharmacy_served BOOLEAN DEFAULT false,
  served_by INTEGER,
  served_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_doctor_visit_id_fkey FOREIGN KEY (doctor_visit_id) REFERENCES doctor_visits(id);
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id);
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_served_by_fkey FOREIGN KEY (served_by) REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_prescription_number_key ON prescriptions(prescription_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_business ON prescriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_visit ON prescriptions(doctor_visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);


-- Table: quotation_lines
CREATE TABLE IF NOT EXISTS quotation_lines (
  id INTEGER NOT NULL DEFAULT nextval('quotation_items_id_seq',
  quotation_id INTEGER NOT NULL,
  item_id INTEGER,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  code VARCHAR(100),
  uom VARCHAR(50),
  category_id INTEGER,
  category_1_id INTEGER,
  category_2_id INTEGER,
  category_name VARCHAR(255),
  category_1_name VARCHAR(255),
  category_2_name VARCHAR(255),
  PRIMARY KEY (id)
);

ALTER TABLE quotation_lines ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES quotations(id);
ALTER TABLE quotation_lines ADD CONSTRAINT quotation_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id);
ALTER TABLE quotation_lines ADD CONSTRAINT quotation_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES item_categories(id);
ALTER TABLE quotation_lines ADD CONSTRAINT quotation_lines_category_1_id_fkey FOREIGN KEY (category_1_id) REFERENCES item_categories(id);
ALTER TABLE quotation_lines ADD CONSTRAINT quotation_lines_category_2_id_fkey FOREIGN KEY (category_2_id) REFERENCES item_categories(id);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_lines(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation_id ON quotation_lines(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_item_id ON quotation_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_category_id ON quotation_lines(category_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_category_1_id ON quotation_lines(category_1_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_category_2_id ON quotation_lines(category_2_id);


-- Table: quotations
CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER NOT NULL DEFAULT nextval('quotations_id_seq',
  business_id INTEGER NOT NULL,
  customer_id INTEGER,
  quotation_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  issue_date DATE NOT NULL,
  valid_until DATE,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  customer_name VARCHAR(255),
  customer_address TEXT,
  customer_pin VARCHAR(50),
  converted_to_invoice_id INTEGER,
  created_by INTEGER,
  payment_method VARCHAR(50) DEFAULT 'Cash',
  mpesa_code VARCHAR(100),
  PRIMARY KEY (id)
);

ALTER TABLE quotations ADD CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE quotations ADD CONSTRAINT quotations_converted_to_invoice_id_fkey FOREIGN KEY (converted_to_invoice_id) REFERENCES invoices(id);

CREATE UNIQUE INDEX IF NOT EXISTS quotations_business_id_quotation_number_key ON quotations(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS quotations_business_id_quotation_number_key ON quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_business_id ON quotations(business_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_number ON quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_valid_until ON quotations(valid_until);


-- Table: salon_employee_performance
CREATE TABLE IF NOT EXISTS salon_employee_performance (
  id INTEGER NOT NULL DEFAULT nextval('salon_employee_performance_id_seq',
  business_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  date DATE NOT NULL,
  total_clients INTEGER DEFAULT 0,
  total_revenue NUMERIC(10, 2) DEFAULT 0,
  total_commission NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE salon_employee_performance ADD CONSTRAINT salon_employee_performance_business_id_fkey FOREIGN KEY (business_id) REFERENCES users(id);
ALTER TABLE salon_employee_performance ADD CONSTRAINT salon_employee_performance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS salon_employee_performance_employee_id_date_key ON salon_employee_performance(date);
CREATE UNIQUE INDEX IF NOT EXISTS salon_employee_performance_employee_id_date_key ON salon_employee_performance(employee_id);
CREATE INDEX IF NOT EXISTS idx_salon_performance_employee ON salon_employee_performance(employee_id);
CREATE INDEX IF NOT EXISTS idx_salon_performance_date ON salon_employee_performance(date);


-- Table: salon_product_usage
CREATE TABLE IF NOT EXISTS salon_product_usage (
  id INTEGER NOT NULL DEFAULT nextval('salon_product_usage_id_seq',
  transaction_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity_used NUMERIC(10, 2) NOT NULL,
  cost NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE salon_product_usage ADD CONSTRAINT salon_product_usage_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES salon_transactions(id);
ALTER TABLE salon_product_usage ADD CONSTRAINT salon_product_usage_product_id_fkey FOREIGN KEY (product_id) REFERENCES salon_products(id);


-- Table: salon_products
CREATE TABLE IF NOT EXISTS salon_products (
  id INTEGER NOT NULL DEFAULT nextval('salon_products_id_seq',
  business_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  unit VARCHAR(20) DEFAULT 'piece',
  current_stock NUMERIC(10, 2) DEFAULT 0,
  min_stock_level NUMERIC(10, 2) DEFAULT 0,
  unit_cost NUMERIC(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE salon_products ADD CONSTRAINT salon_products_business_id_fkey FOREIGN KEY (business_id) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_salon_products_business ON salon_products(business_id);


-- Table: salon_services
CREATE TABLE IF NOT EXISTS salon_services (
  id INTEGER NOT NULL DEFAULT nextval('salon_services_id_seq',
  business_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price NUMERIC(10, 2) NOT NULL,
  duration_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE salon_services ADD CONSTRAINT salon_services_business_id_fkey FOREIGN KEY (business_id) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_salon_services_business ON salon_services(business_id);


-- Table: salon_shifts
CREATE TABLE IF NOT EXISTS salon_shifts (
  id INTEGER NOT NULL DEFAULT nextval('salon_shifts_id_seq',
  business_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  clock_in TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clock_out TIMESTAMP,
  starting_float NUMERIC(10, 2) DEFAULT 0,
  ending_cash NUMERIC(10, 2),
  expected_cash NUMERIC(10, 2),
  cash_difference NUMERIC(10, 2),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE salon_shifts ADD CONSTRAINT salon_shifts_business_id_fkey FOREIGN KEY (business_id) REFERENCES users(id);
ALTER TABLE salon_shifts ADD CONSTRAINT salon_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_salon_shifts_business ON salon_shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_shifts_user ON salon_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_salon_shifts_status ON salon_shifts(status);


-- Table: salon_transactions
CREATE TABLE IF NOT EXISTS salon_transactions (
  id INTEGER NOT NULL DEFAULT nextval('salon_transactions_id_seq',
  business_id INTEGER NOT NULL,
  shift_id INTEGER,
  employee_id INTEGER NOT NULL,
  cashier_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  customer_name VARCHAR(100),
  customer_phone VARCHAR(20),
  service_price NUMERIC(10, 2) NOT NULL,
  employee_commission NUMERIC(10, 2) DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL,
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE salon_transactions ADD CONSTRAINT salon_transactions_business_id_fkey FOREIGN KEY (business_id) REFERENCES users(id);
ALTER TABLE salon_transactions ADD CONSTRAINT salon_transactions_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES salon_shifts(id);
ALTER TABLE salon_transactions ADD CONSTRAINT salon_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id);
ALTER TABLE salon_transactions ADD CONSTRAINT salon_transactions_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES users(id);
ALTER TABLE salon_transactions ADD CONSTRAINT salon_transactions_service_id_fkey FOREIGN KEY (service_id) REFERENCES salon_services(id);

CREATE INDEX IF NOT EXISTS idx_salon_transactions_business ON salon_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_transactions_shift ON salon_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_salon_transactions_employee ON salon_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_salon_transactions_date ON salon_transactions(transaction_date);


-- Table: salon_users
CREATE TABLE IF NOT EXISTS salon_users (
  id INTEGER NOT NULL DEFAULT nextval('salon_users_id_seq',
  user_id INTEGER NOT NULL,
  business_id INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL,
  commission_rate NUMERIC(5, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE salon_users ADD CONSTRAINT salon_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE salon_users ADD CONSTRAINT salon_users_business_id_fkey FOREIGN KEY (business_id) REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS salon_users_user_id_business_id_key ON salon_users(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS salon_users_user_id_business_id_key ON salon_users(user_id);
CREATE INDEX IF NOT EXISTS idx_salon_users_business ON salon_users(business_id);


-- Table: schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
);


-- Table: service_customers
CREATE TABLE IF NOT EXISTS service_customers (
  id INTEGER NOT NULL DEFAULT nextval('service_customers_id_seq',
  business_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  location TEXT,
  email VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE service_customers ADD CONSTRAINT service_customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE INDEX IF NOT EXISTS idx_service_customers_business ON service_customers(business_id);


-- Table: service_invoice_lines
CREATE TABLE IF NOT EXISTS service_invoice_lines (
  id INTEGER NOT NULL DEFAULT nextval('service_invoice_lines_id_seq',
  invoice_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  employee_id INTEGER,
  service_name VARCHAR(255) NOT NULL,
  duration INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE service_invoice_lines ADD CONSTRAINT service_invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES service_invoices(id);
ALTER TABLE service_invoice_lines ADD CONSTRAINT service_invoice_lines_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id);
ALTER TABLE service_invoice_lines ADD CONSTRAINT service_invoice_lines_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);


-- Table: service_invoices
CREATE TABLE IF NOT EXISTS service_invoices (
  id INTEGER NOT NULL DEFAULT nextval('service_invoices_id_seq',
  business_id INTEGER NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  customer_id INTEGER NOT NULL,
  booking_id INTEGER,
  subtotal NUMERIC(10, 2) NOT NULL,
  vat_amount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE service_invoices ADD CONSTRAINT service_invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE service_invoices ADD CONSTRAINT service_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES service_customers(id);
ALTER TABLE service_invoices ADD CONSTRAINT service_invoices_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id);

CREATE UNIQUE INDEX IF NOT EXISTS service_invoices_invoice_number_key ON service_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_service_invoices_business ON service_invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_service_invoices_customer ON service_invoices(customer_id);


-- Table: services
CREATE TABLE IF NOT EXISTS services (
  id INTEGER NOT NULL DEFAULT nextval('services_id_seq',
  business_id INTEGER NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  estimated_duration INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE services ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);


-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER NOT NULL DEFAULT nextval('users_id_seq',
  business_id INTEGER,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'owner',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

ALTER TABLE users ADD CONSTRAINT users_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);

