-- Create M-Pesa C2B Confirmations Table
CREATE TABLE IF NOT EXISTS mpesa_confirmations (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50),
    trans_id VARCHAR(100) UNIQUE NOT NULL,
    trans_time VARCHAR(50),
    trans_amount DECIMAL(15, 2),
    business_short_code VARCHAR(50),
    bill_ref_number VARCHAR(100),
    invoice_number VARCHAR(100),
    org_account_balance DECIMAL(15, 2),
    third_party_trans_id VARCHAR(100),
    msisdn VARCHAR(20),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    result_code INTEGER,
    result_desc VARCHAR(255),
    linked_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    linked_at TIMESTAMP,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_business_id ON mpesa_confirmations(business_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_trans_id ON mpesa_confirmations(trans_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_linked_invoice_id ON mpesa_confirmations(linked_invoice_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_is_processed ON mpesa_confirmations(is_processed);
CREATE INDEX IF NOT EXISTS idx_mpesa_confirmations_created_at ON mpesa_confirmations(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mpesa_confirmations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_mpesa_confirmations_updated_at
    BEFORE UPDATE ON mpesa_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_confirmations_updated_at();

