// User and Business Types
export interface User {
  id: number;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'admin' | 'employee';
  business_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Business {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  logo_url?: string;
  tax_number?: string;
  created_at: Date;
  updated_at: Date;
}

// Product/Item Types
export interface Item {
  id: number;
  business_id: number;
  code: string;
  description: string;
  unit_price: number;
  uom?: string;
  category?: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // New columns added for compatibility
  item_name: string;
  rate: number;
  unit?: string;
  quantity: number;
  amount?: number;
  // New pricing columns
  buying_price: number;
  selling_price: number;
}

// Invoice and Quotation Types
export interface Invoice {
  id: number;
  business_id: number;
  invoice_number: string;
  customer_name: string;
  customer_address?: string;
  customer_pin?: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue';
  quotation_id?: number; // Reference to original quotation if converted
  notes?: string;
  due_date?: Date;
  payment_terms?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  lines?: InvoiceLine[];
}

export interface Quotation {
  id: number;
  business_id: number;
  quotation_number: string;
  customer_name: string;
  customer_address?: string;
  customer_pin?: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  valid_until: Date;
  notes?: string;
  converted_to_invoice_id?: number; // Reference to invoice if converted
  created_by: number;
  created_at: Date;
  updated_at: Date;
  lines?: QuotationLine[];
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  item_id: number;
  quantity: number;
  unit_price: number;
  total: number;
  description: string;
  code: string;
  uom?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface QuotationLine {
  id: number;
  quotation_id: number;
  item_id: number;
  quantity: number;
  unit_price: number;
  total: number;
  description: string;
  code: string;
  uom?: string;
  created_at?: Date;
  updated_at?: Date;
}

// Signature Types
export interface OrderSignature {
  id: number;
  business_id: number;
  order_created_by: string;
  order_approved_by: string;
  created_at: Date;
  updated_at: Date;
}

// Employee Types
export interface Employee {
  id: number;
  business_id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  hire_date: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterBusinessRequest {
  business_name: string;
  business_email: string;
  business_phone?: string;
  business_address?: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_email: string;
  password: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}