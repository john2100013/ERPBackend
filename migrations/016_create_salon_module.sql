-- Salon/Barber Shop Module Migration
-- This creates all tables needed for the salon management system
-- Fixed: Uses INTEGER IDs to match users and businesses tables

-- 1. Salon Users (extends existing users with role-specific data)
CREATE TABLE IF NOT EXISTS salon_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cashier', 'employee')),
    commission_rate DECIMAL(5, 2) DEFAULT 0.00, -- Percentage for employees
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, business_id)
);

-- 2. Service Types (haircut, shave, facial, etc.)
CREATE TABLE IF NOT EXISTS salon_services (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER, -- estimated duration
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products/Stock for salon (gels, dyes, shampoos, etc.)
CREATE TABLE IF NOT EXISTS salon_products (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    unit VARCHAR(20) DEFAULT 'piece', -- ml, piece, bottle, etc.
    current_stock DECIMAL(10, 2) DEFAULT 0,
    min_stock_level DECIMAL(10, 2) DEFAULT 0,
    unit_cost DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Shifts (for clock in/out tracking)
CREATE TABLE IF NOT EXISTS salon_shifts (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clock_in TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clock_out TIMESTAMP,
    starting_float DECIMAL(10, 2) DEFAULT 0, -- for cashiers
    ending_cash DECIMAL(10, 2),
    expected_cash DECIMAL(10, 2),
    cash_difference DECIMAL(10, 2),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Service Transactions (main record of services performed)
CREATE TABLE IF NOT EXISTS salon_transactions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES salon_shifts(id) ON DELETE SET NULL,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- barber/salonist
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES salon_services(id) ON DELETE RESTRICT,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    service_price DECIMAL(10, 2) NOT NULL,
    employee_commission DECIMAL(10, 2) DEFAULT 0, -- calculated based on commission
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'other')),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Product Usage (track products consumed per service)
CREATE TABLE IF NOT EXISTS salon_product_usage (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES salon_transactions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES salon_products(id) ON DELETE CASCADE,
    quantity_used DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Employee Performance Summary (cached/aggregated data for quick reports)
CREATE TABLE IF NOT EXISTS salon_employee_performance (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_clients INTEGER DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    total_commission DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_salon_users_business ON salon_users(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_users_role ON salon_users(role);
CREATE INDEX IF NOT EXISTS idx_salon_services_business ON salon_services(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_products_business ON salon_products(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_shifts_business ON salon_shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_shifts_user ON salon_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_salon_shifts_status ON salon_shifts(status);
CREATE INDEX IF NOT EXISTS idx_salon_transactions_business ON salon_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_transactions_employee ON salon_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_salon_transactions_shift ON salon_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_salon_transactions_date ON salon_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_salon_performance_employee ON salon_employee_performance(employee_id);
CREATE INDEX IF NOT EXISTS idx_salon_performance_date ON salon_employee_performance(date);

-- Function to update timestamps (safe to recreate)
CREATE OR REPLACE FUNCTION update_salon_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at (drop if exists to avoid conflicts)
DROP TRIGGER IF EXISTS salon_users_updated_at ON salon_users;
CREATE TRIGGER salon_users_updated_at BEFORE UPDATE ON salon_users
    FOR EACH ROW EXECUTE FUNCTION update_salon_timestamp();

DROP TRIGGER IF EXISTS salon_services_updated_at ON salon_services;
CREATE TRIGGER salon_services_updated_at BEFORE UPDATE ON salon_services
    FOR EACH ROW EXECUTE FUNCTION update_salon_timestamp();

DROP TRIGGER IF EXISTS salon_products_updated_at ON salon_products;
CREATE TRIGGER salon_products_updated_at BEFORE UPDATE ON salon_products
    FOR EACH ROW EXECUTE FUNCTION update_salon_timestamp();

DROP TRIGGER IF EXISTS salon_shifts_updated_at ON salon_shifts;
CREATE TRIGGER salon_shifts_updated_at BEFORE UPDATE ON salon_shifts
    FOR EACH ROW EXECUTE FUNCTION update_salon_timestamp();

DROP TRIGGER IF EXISTS salon_transactions_updated_at ON salon_transactions;
CREATE TRIGGER salon_transactions_updated_at BEFORE UPDATE ON salon_transactions
    FOR EACH ROW EXECUTE FUNCTION update_salon_timestamp();

DROP TRIGGER IF EXISTS salon_performance_updated_at ON salon_employee_performance;
CREATE TRIGGER salon_performance_updated_at BEFORE UPDATE ON salon_employee_performance
    FOR EACH ROW EXECUTE FUNCTION update_salon_timestamp();
