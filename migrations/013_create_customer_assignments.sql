-- Customer Assignments Table
-- This table tracks when customers are assigned to employees for service
-- Whether they came through booking or walk-in

CREATE TABLE IF NOT EXISTS customer_assignments (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES service_customers(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL, -- NULL for walk-ins
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  assignment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  estimated_duration INTEGER NOT NULL, -- in minutes
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, billed
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_customer_assignments_business ON customer_assignments(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_customer ON customer_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_employee ON customer_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_status ON customer_assignments(status);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_booking ON customer_assignments(booking_id);
