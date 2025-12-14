--
-- PostgreSQL database dump
--

\restrict mIeSCGGy5Oet77Fj5TpCVXLNgWucutBHUIJI8u1aeCB7foDYYf44hOub6OCom3y

-- Dumped from database version 17.7 (178558d)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: generate_damage_number(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_damage_number(business_prefix character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(dr.damage_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM damage_records dr
    WHERE dr.damage_number LIKE 'DMG-' || business_prefix || '%'
    AND LENGTH(dr.damage_number) = LENGTH('DMG-' || business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := 'DMG-' || business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$;


--
-- Name: generate_invoice_number(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number(business_prefix character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(i.invoice_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM invoices i
    WHERE i.invoice_number LIKE business_prefix || '%'
    AND LENGTH(i.invoice_number) = LENGTH(business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$;


--
-- Name: generate_quotation_number(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quotation_number(business_prefix character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(q.quotation_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM quotations q
    WHERE q.quotation_number LIKE 'QT-' || business_prefix || '%'
    AND LENGTH(q.quotation_number) = LENGTH('QT-' || business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := 'QT-' || business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$;


--
-- Name: generate_return_number(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_return_number(business_prefix character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_number INTEGER;
    result_number VARCHAR(50);
BEGIN
    -- Get the next number for this business
    SELECT COALESCE(MAX(CAST(RIGHT(gr.return_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM goods_returns gr
    WHERE gr.return_number LIKE 'RT-' || business_prefix || '%'
    AND LENGTH(gr.return_number) = LENGTH('RT-' || business_prefix) + 4;
    
    -- Format as 4-digit number with leading zeros
    result_number := 'RT-' || business_prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN result_number;
END;
$$;


--
-- Name: update_business_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_business_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_hospital_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_hospital_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_invoice_payment_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_invoice_payment_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update invoice payment status and balance
    UPDATE invoices SET 
        amount_paid = COALESCE((
            SELECT SUM(amount) 
            FROM invoice_payments 
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ), 0),
        balance_due = total_amount - COALESCE((
            SELECT SUM(amount) 
            FROM invoice_payments 
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ), 0),
        payment_status = CASE 
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM invoice_payments 
                WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            ), 0) = 0 THEN 'unpaid'
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM invoice_payments 
                WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            ), 0) < total_amount THEN 'partial'
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM invoice_payments 
                WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            ), 0) = total_amount THEN 'paid'
            ELSE 'overpaid'
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_mpesa_confirmations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_mpesa_confirmations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_salon_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_salon_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: booking_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_services (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    service_id integer NOT NULL,
    employee_id integer,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    estimated_duration integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: booking_services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_services_id_seq OWNED BY public.booking_services.id;


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id integer NOT NULL,
    business_id integer NOT NULL,
    customer_id integer NOT NULL,
    booking_date date NOT NULL,
    booking_time time without time zone NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: business_custom_category_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_custom_category_names (
    id integer NOT NULL,
    business_id integer NOT NULL,
    category_1_name character varying(100) DEFAULT 'Category 1'::character varying,
    category_2_name character varying(100) DEFAULT 'Category 2'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: business_custom_category_names_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_custom_category_names_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: business_custom_category_names_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.business_custom_category_names_id_seq OWNED BY public.business_custom_category_names.id;


--
-- Name: business_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_settings (
    id integer NOT NULL,
    business_id integer NOT NULL,
    business_name character varying(255) NOT NULL,
    street character varying(255),
    city character varying(255),
    email character varying(255) NOT NULL,
    telephone character varying(50) NOT NULL,
    created_by character varying(255),
    approved_by character varying(255),
    created_by_signature text,
    approved_by_signature text,
    logo text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: business_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: business_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.business_settings_id_seq OWNED BY public.business_settings.id;


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: businesses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.businesses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: businesses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.businesses_id_seq OWNED BY public.businesses.id;


--
-- Name: commission_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_settings (
    id integer NOT NULL,
    business_id integer NOT NULL,
    min_customers integer DEFAULT 10 NOT NULL,
    commission_rate numeric(5,2) DEFAULT 10.00 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: commission_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commission_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commission_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commission_settings_id_seq OWNED BY public.commission_settings.id;


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultations (
    id integer NOT NULL,
    business_id integer NOT NULL,
    patient_id integer NOT NULL,
    consultation_number character varying(50) NOT NULL,
    consultation_fee numeric(10,2) DEFAULT 0,
    receipt_generated boolean DEFAULT false,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT consultations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: consultations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consultations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consultations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consultations_id_seq OWNED BY public.consultations.id;


--
-- Name: customer_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_assignments (
    id integer NOT NULL,
    business_id integer NOT NULL,
    customer_id integer NOT NULL,
    employee_id integer NOT NULL,
    booking_id integer,
    service_id integer NOT NULL,
    assignment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp without time zone,
    estimated_duration integer NOT NULL,
    status character varying(50) DEFAULT 'in_progress'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: customer_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_assignments_id_seq OWNED BY public.customer_assignments.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pin character varying(50),
    location text
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: damage_record_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.damage_record_lines (
    id integer NOT NULL,
    damage_record_id integer NOT NULL,
    item_id integer NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    total_cost numeric(12,2) NOT NULL,
    description text NOT NULL,
    code character varying(100) NOT NULL,
    uom character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: damage_record_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.damage_record_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: damage_record_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.damage_record_lines_id_seq OWNED BY public.damage_record_lines.id;


--
-- Name: damage_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.damage_records (
    id integer NOT NULL,
    business_id integer NOT NULL,
    damage_number character varying(50) NOT NULL,
    damage_date date DEFAULT CURRENT_DATE NOT NULL,
    damage_type character varying(20) NOT NULL,
    total_cost numeric(12,2) DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT damage_records_damage_type_check CHECK (((damage_type)::text = ANY ((ARRAY['damaged'::character varying, 'expired'::character varying, 'lost'::character varying, 'stolen'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT damage_records_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: damage_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.damage_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: damage_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.damage_records_id_seq OWNED BY public.damage_records.id;


--
-- Name: doctor_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_visits (
    id integer NOT NULL,
    business_id integer NOT NULL,
    consultation_id integer NOT NULL,
    patient_id integer NOT NULL,
    symptoms text,
    blood_pressure character varying(20),
    temperature numeric(5,2),
    heart_rate integer,
    other_analysis text,
    disease_diagnosis character varying(255),
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying,
    lab_test_required boolean DEFAULT false,
    doctor_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doctor_visits_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'waiting_lab'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: doctor_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctor_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctor_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctor_visits_id_seq OWNED BY public.doctor_visits.id;


--
-- Name: employee_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_commissions (
    id integer NOT NULL,
    business_id integer NOT NULL,
    employee_id integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_customers integer NOT NULL,
    total_revenue numeric(10,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employee_commissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_commissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_commissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_commissions_id_seq OWNED BY public.employee_commissions.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50),
    email character varying(255),
    "position" character varying(100),
    commission_rate numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: financial_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_accounts (
    id integer NOT NULL,
    business_id integer NOT NULL,
    account_name character varying(255) NOT NULL,
    account_type character varying(50) NOT NULL,
    account_number character varying(100),
    bank_name character varying(255),
    opening_balance numeric(12,2) DEFAULT 0,
    current_balance numeric(12,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT financial_accounts_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['cash'::character varying, 'bank'::character varying, 'mobile_money'::character varying])::text[])))
);


--
-- Name: financial_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_accounts_id_seq OWNED BY public.financial_accounts.id;


--
-- Name: goods_return_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_return_lines (
    id integer NOT NULL,
    return_id integer NOT NULL,
    item_id integer NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    description text NOT NULL,
    code character varying(100) NOT NULL,
    uom character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: goods_return_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_return_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_return_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_return_lines_id_seq OWNED BY public.goods_return_lines.id;


--
-- Name: goods_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_returns (
    id integer NOT NULL,
    business_id integer NOT NULL,
    return_number character varying(50) NOT NULL,
    invoice_id integer,
    customer_name character varying(255) NOT NULL,
    return_date date DEFAULT CURRENT_DATE NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    vat_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0,
    refund_method character varying(50),
    financial_account_id integer,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reason text,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT goods_returns_refund_method_check CHECK (((refund_method)::text = ANY ((ARRAY['cash'::character varying, 'bank'::character varying, 'mobile_money'::character varying, 'credit_note'::character varying])::text[]))),
    CONSTRAINT goods_returns_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: goods_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goods_returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goods_returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goods_returns_id_seq OWNED BY public.goods_returns.id;


--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_lines (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    item_id integer,
    description character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    code character varying(100),
    uom character varying(50),
    category_id integer,
    category_1_id integer,
    category_2_id integer,
    category_name character varying(255),
    category_1_name character varying(255),
    category_2_name character varying(255)
);


--
-- Name: invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_items_id_seq OWNED BY public.invoice_lines.id;


--
-- Name: invoice_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_payments (
    id integer NOT NULL,
    business_id integer NOT NULL,
    invoice_id integer NOT NULL,
    financial_account_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    payment_reference character varying(255),
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoice_payments_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'bank'::character varying, 'mobile_money'::character varying, 'cheque'::character varying, 'card'::character varying])::text[])))
);


--
-- Name: invoice_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_payments_id_seq OWNED BY public.invoice_payments.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    business_id integer NOT NULL,
    customer_id integer,
    invoice_number character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    issue_date date NOT NULL,
    due_date date,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    vat_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    customer_name character varying(255),
    customer_address text,
    customer_pin character varying(50),
    quotation_id integer,
    payment_terms character varying(255) DEFAULT 'Net 30 Days'::character varying,
    created_by integer,
    amount_paid numeric(12,2) DEFAULT 0,
    balance_due numeric(12,2) DEFAULT 0,
    payment_status character varying(20) DEFAULT 'unpaid'::character varying,
    payment_method character varying(50) DEFAULT 'Cash'::character varying,
    mpesa_code character varying(100),
    CONSTRAINT invoices_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying, 'overpaid'::character varying])::text[])))
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: item_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_categories (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: item_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_categories_id_seq OWNED BY public.item_categories.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    category character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    buying_price numeric(12,2) DEFAULT 0,
    selling_price numeric(12,2) DEFAULT 0,
    category_id integer,
    manufacturing_date date,
    expiry_date date,
    reorder_level integer DEFAULT 10,
    cost_price numeric(10,2) DEFAULT 0,
    category_1_id integer,
    category_2_id integer
);


--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_tests (
    id integer NOT NULL,
    business_id integer NOT NULL,
    doctor_visit_id integer NOT NULL,
    patient_id integer NOT NULL,
    test_name character varying(255) NOT NULL,
    test_type character varying(100),
    test_requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    test_completed_at timestamp without time zone,
    test_result text,
    test_status character varying(20) DEFAULT 'pending'::character varying,
    lab_technician_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    attachment_url text,
    attachment_filename character varying(255),
    category character varying(100),
    others text,
    price numeric(10,2) DEFAULT 0,
    payment_status character varying(20) DEFAULT 'unpaid'::character varying,
    amount_due numeric(10,2) DEFAULT 0,
    amount_paid numeric(10,2) DEFAULT 0,
    pharmacy_served boolean DEFAULT false,
    served_by integer,
    served_at timestamp without time zone,
    CONSTRAINT lab_tests_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['unpaid'::character varying, 'paid'::character varying, 'partially_paid'::character varying])::text[]))),
    CONSTRAINT lab_tests_test_status_check CHECK (((test_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: lab_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lab_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lab_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lab_tests_id_seq OWNED BY public.lab_tests.id;


--
-- Name: mpesa_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mpesa_confirmations (
    id integer NOT NULL,
    business_id integer NOT NULL,
    transaction_type character varying(50),
    trans_id character varying(100) NOT NULL,
    trans_time character varying(50),
    trans_amount numeric(15,2),
    business_short_code character varying(50),
    bill_ref_number character varying(100),
    invoice_number character varying(100),
    org_account_balance numeric(15,2),
    third_party_trans_id character varying(100),
    msisdn character varying(20),
    first_name character varying(100),
    middle_name character varying(100),
    last_name character varying(100),
    result_code integer,
    result_desc character varying(255),
    linked_invoice_id integer,
    linked_at timestamp without time zone,
    is_processed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: mpesa_confirmations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mpesa_confirmations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mpesa_confirmations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mpesa_confirmations_id_seq OWNED BY public.mpesa_confirmations.id;


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id integer NOT NULL,
    business_id integer NOT NULL,
    patient_name character varying(255) NOT NULL,
    national_id character varying(50),
    location character varying(255),
    age integer,
    phone_number character varying(20),
    email character varying(255),
    is_first_visit boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: patients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patients_id_seq OWNED BY public.patients.id;


--
-- Name: prescription_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_items (
    id integer NOT NULL,
    prescription_id integer NOT NULL,
    item_id integer NOT NULL,
    item_name character varying(255) NOT NULL,
    quantity_prescribed numeric(10,2) NOT NULL,
    quantity_available numeric(10,2) DEFAULT 0,
    quantity_fulfilled numeric(10,2) DEFAULT 0,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    is_available boolean DEFAULT true,
    is_missing boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: prescription_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prescription_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prescription_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prescription_items_id_seq OWNED BY public.prescription_items.id;


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    id integer NOT NULL,
    business_id integer NOT NULL,
    doctor_visit_id integer NOT NULL,
    patient_id integer NOT NULL,
    prescription_number character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    total_amount numeric(10,2) DEFAULT 0,
    amount_paid numeric(10,2) DEFAULT 0,
    pharmacy_served boolean DEFAULT false,
    served_by integer,
    served_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT prescriptions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'partially_fulfilled'::character varying, 'fulfilled'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: prescriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prescriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prescriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prescriptions_id_seq OWNED BY public.prescriptions.id;


--
-- Name: quotation_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotation_lines (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    item_id integer,
    description character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    code character varying(100),
    uom character varying(50),
    category_id integer,
    category_1_id integer,
    category_2_id integer,
    category_name character varying(255),
    category_1_name character varying(255),
    category_2_name character varying(255)
);


--
-- Name: quotation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quotation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quotation_items_id_seq OWNED BY public.quotation_lines.id;


--
-- Name: quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotations (
    id integer NOT NULL,
    business_id integer NOT NULL,
    customer_id integer,
    quotation_number character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    issue_date date NOT NULL,
    valid_until date,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    vat_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    customer_name character varying(255),
    customer_address text,
    customer_pin character varying(50),
    converted_to_invoice_id integer,
    created_by integer,
    payment_method character varying(50) DEFAULT 'Cash'::character varying,
    mpesa_code character varying(100)
);


--
-- Name: quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quotations_id_seq OWNED BY public.quotations.id;


--
-- Name: salon_employee_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_employee_performance (
    id integer NOT NULL,
    business_id integer NOT NULL,
    employee_id integer NOT NULL,
    date date NOT NULL,
    total_clients integer DEFAULT 0,
    total_revenue numeric(10,2) DEFAULT 0,
    total_commission numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: salon_employee_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salon_employee_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salon_employee_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salon_employee_performance_id_seq OWNED BY public.salon_employee_performance.id;


--
-- Name: salon_product_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_product_usage (
    id integer NOT NULL,
    transaction_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity_used numeric(10,2) NOT NULL,
    cost numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: salon_product_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salon_product_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salon_product_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salon_product_usage_id_seq OWNED BY public.salon_product_usage.id;


--
-- Name: salon_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_products (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    unit character varying(20) DEFAULT 'piece'::character varying,
    current_stock numeric(10,2) DEFAULT 0,
    min_stock_level numeric(10,2) DEFAULT 0,
    unit_cost numeric(10,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: salon_products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salon_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salon_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salon_products_id_seq OWNED BY public.salon_products.id;


--
-- Name: salon_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_services (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    base_price numeric(10,2) NOT NULL,
    duration_minutes integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: salon_services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salon_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salon_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salon_services_id_seq OWNED BY public.salon_services.id;


--
-- Name: salon_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_shifts (
    id integer NOT NULL,
    business_id integer NOT NULL,
    user_id integer NOT NULL,
    clock_in timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    clock_out timestamp without time zone,
    starting_float numeric(10,2) DEFAULT 0,
    ending_cash numeric(10,2),
    expected_cash numeric(10,2),
    cash_difference numeric(10,2),
    notes text,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT salon_shifts_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: salon_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salon_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salon_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salon_shifts_id_seq OWNED BY public.salon_shifts.id;


--
-- Name: salon_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_transactions (
    id integer NOT NULL,
    business_id integer NOT NULL,
    shift_id integer,
    employee_id integer NOT NULL,
    cashier_id integer NOT NULL,
    service_id integer NOT NULL,
    customer_name character varying(100),
    customer_phone character varying(20),
    service_price numeric(10,2) NOT NULL,
    employee_commission numeric(10,2) DEFAULT 0,
    payment_method character varying(20) NOT NULL,
    transaction_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT salon_transactions_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cash'::character varying, 'mpesa'::character varying, 'card'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: salon_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salon_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salon_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salon_transactions_id_seq OWNED BY public.salon_transactions.id;


--
-- Name: salon_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_users (
    id integer NOT NULL,
    user_id integer NOT NULL,
    business_id integer NOT NULL,
    role character varying(20) NOT NULL,
    commission_rate numeric(5,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT salon_users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'cashier'::character varying, 'employee'::character varying])::text[])))
);


--
-- Name: salon_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salon_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salon_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salon_users_id_seq OWNED BY public.salon_users.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL,
    executed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: service_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_customers (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    location text,
    email character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: service_customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_customers_id_seq OWNED BY public.service_customers.id;


--
-- Name: service_invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_invoice_lines (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    service_id integer NOT NULL,
    employee_id integer,
    service_name character varying(255) NOT NULL,
    duration integer NOT NULL,
    price numeric(10,2) NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: service_invoice_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_invoice_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_invoice_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_invoice_lines_id_seq OWNED BY public.service_invoice_lines.id;


--
-- Name: service_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_invoices (
    id integer NOT NULL,
    business_id integer NOT NULL,
    invoice_number character varying(50) NOT NULL,
    customer_id integer NOT NULL,
    booking_id integer,
    subtotal numeric(10,2) NOT NULL,
    vat_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) NOT NULL,
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: service_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_invoices_id_seq OWNED BY public.service_invoices.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id integer NOT NULL,
    business_id integer NOT NULL,
    service_name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    estimated_duration integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    business_id integer,
    email character varying(255) NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'owner'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: booking_services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services ALTER COLUMN id SET DEFAULT nextval('public.booking_services_id_seq'::regclass);


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: business_custom_category_names id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_custom_category_names ALTER COLUMN id SET DEFAULT nextval('public.business_custom_category_names_id_seq'::regclass);


--
-- Name: business_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_settings ALTER COLUMN id SET DEFAULT nextval('public.business_settings_id_seq'::regclass);


--
-- Name: businesses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses ALTER COLUMN id SET DEFAULT nextval('public.businesses_id_seq'::regclass);


--
-- Name: commission_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_settings ALTER COLUMN id SET DEFAULT nextval('public.commission_settings_id_seq'::regclass);


--
-- Name: consultations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations ALTER COLUMN id SET DEFAULT nextval('public.consultations_id_seq'::regclass);


--
-- Name: customer_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_assignments ALTER COLUMN id SET DEFAULT nextval('public.customer_assignments_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: damage_record_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.damage_record_lines ALTER COLUMN id SET DEFAULT nextval('public.damage_record_lines_id_seq'::regclass);


--
-- Name: damage_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.damage_records ALTER COLUMN id SET DEFAULT nextval('public.damage_records_id_seq'::regclass);


--
-- Name: doctor_visits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_visits ALTER COLUMN id SET DEFAULT nextval('public.doctor_visits_id_seq'::regclass);


--
-- Name: employee_commissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_commissions ALTER COLUMN id SET DEFAULT nextval('public.employee_commissions_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: financial_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_accounts ALTER COLUMN id SET DEFAULT nextval('public.financial_accounts_id_seq'::regclass);


--
-- Name: goods_return_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_return_lines ALTER COLUMN id SET DEFAULT nextval('public.goods_return_lines_id_seq'::regclass);


--
-- Name: goods_returns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_returns ALTER COLUMN id SET DEFAULT nextval('public.goods_returns_id_seq'::regclass);


--
-- Name: invoice_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines ALTER COLUMN id SET DEFAULT nextval('public.invoice_items_id_seq'::regclass);


--
-- Name: invoice_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments ALTER COLUMN id SET DEFAULT nextval('public.invoice_payments_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: item_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_categories ALTER COLUMN id SET DEFAULT nextval('public.item_categories_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: lab_tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests ALTER COLUMN id SET DEFAULT nextval('public.lab_tests_id_seq'::regclass);


--
-- Name: mpesa_confirmations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_confirmations ALTER COLUMN id SET DEFAULT nextval('public.mpesa_confirmations_id_seq'::regclass);


--
-- Name: patients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients ALTER COLUMN id SET DEFAULT nextval('public.patients_id_seq'::regclass);


--
-- Name: prescription_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items ALTER COLUMN id SET DEFAULT nextval('public.prescription_items_id_seq'::regclass);


--
-- Name: prescriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions ALTER COLUMN id SET DEFAULT nextval('public.prescriptions_id_seq'::regclass);


--
-- Name: quotation_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_lines ALTER COLUMN id SET DEFAULT nextval('public.quotation_items_id_seq'::regclass);


--
-- Name: quotations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations ALTER COLUMN id SET DEFAULT nextval('public.quotations_id_seq'::regclass);


--
-- Name: salon_employee_performance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_employee_performance ALTER COLUMN id SET DEFAULT nextval('public.salon_employee_performance_id_seq'::regclass);


--
-- Name: salon_product_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_product_usage ALTER COLUMN id SET DEFAULT nextval('public.salon_product_usage_id_seq'::regclass);


--
-- Name: salon_products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_products ALTER COLUMN id SET DEFAULT nextval('public.salon_products_id_seq'::regclass);


--
-- Name: salon_services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_services ALTER COLUMN id SET DEFAULT nextval('public.salon_services_id_seq'::regclass);


--
-- Name: salon_shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_shifts ALTER COLUMN id SET DEFAULT nextval('public.salon_shifts_id_seq'::regclass);


--
-- Name: salon_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_transactions ALTER COLUMN id SET DEFAULT nextval('public.salon_transactions_id_seq'::regclass);


--
-- Name: salon_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_users ALTER COLUMN id SET DEFAULT nextval('public.salon_users_id_seq'::regclass);


--
-- Name: service_customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_customers ALTER COLUMN id SET DEFAULT nextval('public.service_customers_id_seq'::regclass);


--
-- Name: service_invoice_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoice_lines ALTER COLUMN id SET DEFAULT nextval('public.service_invoice_lines_id_seq'::regclass);


--
-- Name: service_invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoices ALTER COLUMN id SET DEFAULT nextval('public.service_invoices_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: booking_services booking_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: business_custom_category_names business_custom_category_names_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_custom_category_names
    ADD CONSTRAINT business_custom_category_names_business_id_key UNIQUE (business_id);


--
-- Name: business_custom_category_names business_custom_category_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_custom_category_names
    ADD CONSTRAINT business_custom_category_names_pkey PRIMARY KEY (id);


--
-- Name: business_settings business_settings_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_business_id_key UNIQUE (business_id);


--
-- Name: business_settings business_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: commission_settings commission_settings_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_settings
    ADD CONSTRAINT commission_settings_business_id_key UNIQUE (business_id);


--
-- Name: commission_settings commission_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_settings
    ADD CONSTRAINT commission_settings_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_consultation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_consultation_number_key UNIQUE (consultation_number);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: customer_assignments customer_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_assignments
    ADD CONSTRAINT customer_assignments_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: damage_record_lines damage_record_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.damage_record_lines
    ADD CONSTRAINT damage_record_lines_pkey PRIMARY KEY (id);


--
-- Name: damage_records damage_records_damage_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.damage_records
    ADD CONSTRAINT damage_records_damage_number_key UNIQUE (damage_number);


--
-- Name: damage_records damage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.damage_records
    ADD CONSTRAINT damage_records_pkey PRIMARY KEY (id);


--
-- Name: doctor_visits doctor_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_visits
    ADD CONSTRAINT doctor_visits_pkey PRIMARY KEY (id);


--
-- Name: employee_commissions employee_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_commissions
    ADD CONSTRAINT employee_commissions_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: financial_accounts financial_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_pkey PRIMARY KEY (id);


--
-- Name: goods_return_lines goods_return_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_return_lines
    ADD CONSTRAINT goods_return_lines_pkey PRIMARY KEY (id);


--
-- Name: goods_returns goods_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_returns
    ADD CONSTRAINT goods_returns_pkey PRIMARY KEY (id);


--
-- Name: goods_returns goods_returns_return_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_returns
    ADD CONSTRAINT goods_returns_return_number_key UNIQUE (return_number);


--
-- Name: invoice_lines invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_business_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_business_id_invoice_number_key UNIQUE (business_id, invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: item_categories item_categories_business_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_categories
    ADD CONSTRAINT item_categories_business_id_name_key UNIQUE (business_id, name);


--
-- Name: item_categories item_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_categories
    ADD CONSTRAINT item_categories_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: lab_tests lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_pkey PRIMARY KEY (id);


--
-- Name: mpesa_confirmations mpesa_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_confirmations
    ADD CONSTRAINT mpesa_confirmations_pkey PRIMARY KEY (id);


--
-- Name: mpesa_confirmations mpesa_confirmations_trans_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_confirmations
    ADD CONSTRAINT mpesa_confirmations_trans_id_key UNIQUE (trans_id);


--
-- Name: patients patients_national_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_national_id_key UNIQUE (national_id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: prescription_items prescription_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_prescription_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_prescription_number_key UNIQUE (prescription_number);


--
-- Name: quotation_lines quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_business_id_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_business_id_quotation_number_key UNIQUE (business_id, quotation_number);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: salon_employee_performance salon_employee_performance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_employee_performance
    ADD CONSTRAINT salon_employee_performance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: salon_employee_performance salon_employee_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_employee_performance
    ADD CONSTRAINT salon_employee_performance_pkey PRIMARY KEY (id);


--
-- Name: salon_product_usage salon_product_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_product_usage
    ADD CONSTRAINT salon_product_usage_pkey PRIMARY KEY (id);


--
-- Name: salon_products salon_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_products
    ADD CONSTRAINT salon_products_pkey PRIMARY KEY (id);


--
-- Name: salon_services salon_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_services
    ADD CONSTRAINT salon_services_pkey PRIMARY KEY (id);


--
-- Name: salon_shifts salon_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_shifts
    ADD CONSTRAINT salon_shifts_pkey PRIMARY KEY (id);


--
-- Name: salon_transactions salon_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_transactions
    ADD CONSTRAINT salon_transactions_pkey PRIMARY KEY (id);


--
-- Name: salon_users salon_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_users
    ADD CONSTRAINT salon_users_pkey PRIMARY KEY (id);


--
-- Name: salon_users salon_users_user_id_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_users
    ADD CONSTRAINT salon_users_user_id_business_id_key UNIQUE (user_id, business_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: service_customers service_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_customers
    ADD CONSTRAINT service_customers_pkey PRIMARY KEY (id);


--
-- Name: service_invoice_lines service_invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoice_lines
    ADD CONSTRAINT service_invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: service_invoices service_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoices
    ADD CONSTRAINT service_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: service_invoices service_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoices
    ADD CONSTRAINT service_invoices_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_booking_services_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_services_booking ON public.booking_services USING btree (booking_id);


--
-- Name: idx_booking_services_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_services_employee ON public.booking_services USING btree (employee_id);


--
-- Name: idx_bookings_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_business ON public.bookings USING btree (business_id);


--
-- Name: idx_bookings_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_customer ON public.bookings USING btree (customer_id);


--
-- Name: idx_bookings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_date ON public.bookings USING btree (booking_date);


--
-- Name: idx_business_custom_category_names_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_custom_category_names_business_id ON public.business_custom_category_names USING btree (business_id);


--
-- Name: idx_business_settings_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_settings_business_id ON public.business_settings USING btree (business_id);


--
-- Name: idx_businesses_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_name ON public.businesses USING btree (name);


--
-- Name: idx_consultations_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_business ON public.consultations USING btree (business_id);


--
-- Name: idx_consultations_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_number ON public.consultations USING btree (consultation_number);


--
-- Name: idx_consultations_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_patient ON public.consultations USING btree (patient_id);


--
-- Name: idx_consultations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_status ON public.consultations USING btree (status);


--
-- Name: idx_customer_assignments_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_assignments_booking ON public.customer_assignments USING btree (booking_id);


--
-- Name: idx_customer_assignments_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_assignments_business ON public.customer_assignments USING btree (business_id);


--
-- Name: idx_customer_assignments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_assignments_customer ON public.customer_assignments USING btree (customer_id);


--
-- Name: idx_customer_assignments_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_assignments_employee ON public.customer_assignments USING btree (employee_id);


--
-- Name: idx_customer_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_assignments_status ON public.customer_assignments USING btree (status);


--
-- Name: idx_customers_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_business_id ON public.customers USING btree (business_id);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_pin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_pin ON public.customers USING btree (pin);


--
-- Name: idx_damage_record_lines_damage_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_damage_record_lines_damage_record_id ON public.damage_record_lines USING btree (damage_record_id);


--
-- Name: idx_damage_record_lines_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_damage_record_lines_item_id ON public.damage_record_lines USING btree (item_id);


--
-- Name: idx_damage_records_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_damage_records_business_id ON public.damage_records USING btree (business_id);


--
-- Name: idx_damage_records_damage_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_damage_records_damage_number ON public.damage_records USING btree (damage_number);


--
-- Name: idx_damage_records_damage_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_damage_records_damage_type ON public.damage_records USING btree (damage_type);


--
-- Name: idx_damage_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_damage_records_status ON public.damage_records USING btree (status);


--
-- Name: idx_doctor_visits_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_visits_business ON public.doctor_visits USING btree (business_id);


--
-- Name: idx_doctor_visits_consultation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_visits_consultation ON public.doctor_visits USING btree (consultation_id);


--
-- Name: idx_doctor_visits_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_visits_patient ON public.doctor_visits USING btree (patient_id);


--
-- Name: idx_doctor_visits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_visits_status ON public.doctor_visits USING btree (status);


--
-- Name: idx_employee_commissions_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_commissions_employee ON public.employee_commissions USING btree (employee_id);


--
-- Name: idx_employees_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_business ON public.employees USING btree (business_id);


--
-- Name: idx_financial_accounts_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_accounts_business_id ON public.financial_accounts USING btree (business_id);


--
-- Name: idx_financial_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_accounts_type ON public.financial_accounts USING btree (account_type);


--
-- Name: idx_goods_return_lines_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_return_lines_item_id ON public.goods_return_lines USING btree (item_id);


--
-- Name: idx_goods_return_lines_return_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_return_lines_return_id ON public.goods_return_lines USING btree (return_id);


--
-- Name: idx_goods_returns_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_returns_business_id ON public.goods_returns USING btree (business_id);


--
-- Name: idx_goods_returns_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_returns_invoice_id ON public.goods_returns USING btree (invoice_id);


--
-- Name: idx_goods_returns_return_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goods_returns_return_number ON public.goods_returns USING btree (return_number);


--
-- Name: idx_invoice_items_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_lines USING btree (invoice_id);


--
-- Name: idx_invoice_lines_category_1_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_category_1_id ON public.invoice_lines USING btree (category_1_id);


--
-- Name: idx_invoice_lines_category_2_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_category_2_id ON public.invoice_lines USING btree (category_2_id);


--
-- Name: idx_invoice_lines_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_category_id ON public.invoice_lines USING btree (category_id);


--
-- Name: idx_invoice_lines_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_invoice_id ON public.invoice_lines USING btree (invoice_id);


--
-- Name: idx_invoice_lines_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_item_id ON public.invoice_lines USING btree (item_id);


--
-- Name: idx_invoice_payments_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_payments_business_id ON public.invoice_payments USING btree (business_id);


--
-- Name: idx_invoice_payments_financial_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_payments_financial_account_id ON public.invoice_payments USING btree (financial_account_id);


--
-- Name: idx_invoice_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments USING btree (invoice_id);


--
-- Name: idx_invoices_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_business_id ON public.invoices USING btree (business_id);


--
-- Name: idx_invoices_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_created_at ON public.invoices USING btree (created_at);


--
-- Name: idx_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer_id ON public.invoices USING btree (customer_id);


--
-- Name: idx_invoices_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_invoice_number ON public.invoices USING btree (invoice_number);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_item_categories_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_categories_business_id ON public.item_categories USING btree (business_id);


--
-- Name: idx_items_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_business_id ON public.items USING btree (business_id);


--
-- Name: idx_items_category_1_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_category_1_id ON public.items USING btree (category_1_id);


--
-- Name: idx_items_category_2_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_category_2_id ON public.items USING btree (category_2_id);


--
-- Name: idx_items_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_category_id ON public.items USING btree (category_id);


--
-- Name: idx_lab_tests_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_business ON public.lab_tests USING btree (business_id);


--
-- Name: idx_lab_tests_doctor_visit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_doctor_visit ON public.lab_tests USING btree (doctor_visit_id);


--
-- Name: idx_lab_tests_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_patient ON public.lab_tests USING btree (patient_id);


--
-- Name: idx_lab_tests_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_payment_status ON public.lab_tests USING btree (payment_status);


--
-- Name: idx_lab_tests_pharmacy_served; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_pharmacy_served ON public.lab_tests USING btree (pharmacy_served);


--
-- Name: idx_lab_tests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_tests_status ON public.lab_tests USING btree (test_status);


--
-- Name: idx_mpesa_confirmations_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mpesa_confirmations_business_id ON public.mpesa_confirmations USING btree (business_id);


--
-- Name: idx_mpesa_confirmations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mpesa_confirmations_created_at ON public.mpesa_confirmations USING btree (created_at);


--
-- Name: idx_mpesa_confirmations_is_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mpesa_confirmations_is_processed ON public.mpesa_confirmations USING btree (is_processed);


--
-- Name: idx_mpesa_confirmations_linked_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mpesa_confirmations_linked_invoice_id ON public.mpesa_confirmations USING btree (linked_invoice_id);


--
-- Name: idx_mpesa_confirmations_trans_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mpesa_confirmations_trans_id ON public.mpesa_confirmations USING btree (trans_id);


--
-- Name: idx_patients_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_business ON public.patients USING btree (business_id);


--
-- Name: idx_patients_national_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_national_id ON public.patients USING btree (national_id);


--
-- Name: idx_prescription_items_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_items_item ON public.prescription_items USING btree (item_id);


--
-- Name: idx_prescription_items_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_items_prescription ON public.prescription_items USING btree (prescription_id);


--
-- Name: idx_prescriptions_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_business ON public.prescriptions USING btree (business_id);


--
-- Name: idx_prescriptions_doctor_visit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_doctor_visit ON public.prescriptions USING btree (doctor_visit_id);


--
-- Name: idx_prescriptions_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_number ON public.prescriptions USING btree (prescription_number);


--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_patient ON public.prescriptions USING btree (patient_id);


--
-- Name: idx_prescriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_status ON public.prescriptions USING btree (status);


--
-- Name: idx_quotation_items_quotation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_items_quotation_id ON public.quotation_lines USING btree (quotation_id);


--
-- Name: idx_quotation_lines_category_1_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_lines_category_1_id ON public.quotation_lines USING btree (category_1_id);


--
-- Name: idx_quotation_lines_category_2_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_lines_category_2_id ON public.quotation_lines USING btree (category_2_id);


--
-- Name: idx_quotation_lines_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_lines_category_id ON public.quotation_lines USING btree (category_id);


--
-- Name: idx_quotation_lines_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_lines_item_id ON public.quotation_lines USING btree (item_id);


--
-- Name: idx_quotation_lines_quotation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_lines_quotation_id ON public.quotation_lines USING btree (quotation_id);


--
-- Name: idx_quotations_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_business_id ON public.quotations USING btree (business_id);


--
-- Name: idx_quotations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_created_at ON public.quotations USING btree (created_at);


--
-- Name: idx_quotations_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_customer_id ON public.quotations USING btree (customer_id);


--
-- Name: idx_quotations_quotation_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_quotation_number ON public.quotations USING btree (quotation_number);


--
-- Name: idx_quotations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_status ON public.quotations USING btree (status);


--
-- Name: idx_quotations_valid_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_valid_until ON public.quotations USING btree (valid_until);


--
-- Name: idx_salon_performance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_performance_date ON public.salon_employee_performance USING btree (date);


--
-- Name: idx_salon_performance_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_performance_employee ON public.salon_employee_performance USING btree (employee_id);


--
-- Name: idx_salon_products_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_products_business ON public.salon_products USING btree (business_id);


--
-- Name: idx_salon_services_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_services_business ON public.salon_services USING btree (business_id);


--
-- Name: idx_salon_shifts_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_shifts_business ON public.salon_shifts USING btree (business_id);


--
-- Name: idx_salon_shifts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_shifts_status ON public.salon_shifts USING btree (status);


--
-- Name: idx_salon_shifts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_shifts_user ON public.salon_shifts USING btree (user_id);


--
-- Name: idx_salon_transactions_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_transactions_business ON public.salon_transactions USING btree (business_id);


--
-- Name: idx_salon_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_transactions_date ON public.salon_transactions USING btree (transaction_date);


--
-- Name: idx_salon_transactions_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_transactions_employee ON public.salon_transactions USING btree (employee_id);


--
-- Name: idx_salon_transactions_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_transactions_shift ON public.salon_transactions USING btree (shift_id);


--
-- Name: idx_salon_users_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salon_users_business ON public.salon_users USING btree (business_id);


--
-- Name: idx_service_customers_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_customers_business ON public.service_customers USING btree (business_id);


--
-- Name: idx_service_invoices_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_invoices_business ON public.service_invoices USING btree (business_id);


--
-- Name: idx_service_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_invoices_customer ON public.service_invoices USING btree (customer_id);


--
-- Name: idx_services_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_business ON public.services USING btree (business_id);


--
-- Name: idx_users_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_business_id ON public.users USING btree (business_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: invoice_payments trigger_update_invoice_payment_status_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_invoice_payment_status_delete AFTER DELETE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();


--
-- Name: invoice_payments trigger_update_invoice_payment_status_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_invoice_payment_status_insert AFTER INSERT ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();


--
-- Name: invoice_payments trigger_update_invoice_payment_status_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_invoice_payment_status_update AFTER UPDATE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();


--
-- Name: mpesa_confirmations trigger_update_mpesa_confirmations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_mpesa_confirmations_updated_at BEFORE UPDATE ON public.mpesa_confirmations FOR EACH ROW EXECUTE FUNCTION public.update_mpesa_confirmations_updated_at();


--
-- Name: business_settings update_business_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_settings_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.update_business_settings_updated_at();


--
-- Name: consultations update_consultations_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_consultations_timestamp BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_hospital_updated_at();


--
-- Name: damage_record_lines update_damage_record_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_damage_record_lines_updated_at BEFORE UPDATE ON public.damage_record_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: damage_records update_damage_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_damage_records_updated_at BEFORE UPDATE ON public.damage_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_visits update_doctor_visits_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctor_visits_timestamp BEFORE UPDATE ON public.doctor_visits FOR EACH ROW EXECUTE FUNCTION public.update_hospital_updated_at();


--
-- Name: financial_accounts update_financial_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_financial_accounts_updated_at BEFORE UPDATE ON public.financial_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: goods_return_lines update_goods_return_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_goods_return_lines_updated_at BEFORE UPDATE ON public.goods_return_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: goods_returns update_goods_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_goods_returns_updated_at BEFORE UPDATE ON public.goods_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoice_lines update_invoice_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoice_lines_updated_at BEFORE UPDATE ON public.invoice_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoice_payments update_invoice_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoice_payments_updated_at BEFORE UPDATE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lab_tests update_lab_tests_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lab_tests_timestamp BEFORE UPDATE ON public.lab_tests FOR EACH ROW EXECUTE FUNCTION public.update_hospital_updated_at();


--
-- Name: patients update_patients_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_patients_timestamp BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_hospital_updated_at();


--
-- Name: prescription_items update_prescription_items_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_prescription_items_timestamp BEFORE UPDATE ON public.prescription_items FOR EACH ROW EXECUTE FUNCTION public.update_hospital_updated_at();


--
-- Name: prescriptions update_prescriptions_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_prescriptions_timestamp BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.update_hospital_updated_at();


--
-- Name: quotation_lines update_quotation_lines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quotation_lines_updated_at BEFORE UPDATE ON public.quotation_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotations update_quotations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: salon_employee_performance update_salon_performance_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salon_performance_timestamp BEFORE UPDATE ON public.salon_employee_performance FOR EACH ROW EXECUTE FUNCTION public.update_salon_updated_at();


--
-- Name: salon_products update_salon_products_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salon_products_timestamp BEFORE UPDATE ON public.salon_products FOR EACH ROW EXECUTE FUNCTION public.update_salon_updated_at();


--
-- Name: salon_services update_salon_services_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salon_services_timestamp BEFORE UPDATE ON public.salon_services FOR EACH ROW EXECUTE FUNCTION public.update_salon_updated_at();


--
-- Name: salon_shifts update_salon_shifts_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salon_shifts_timestamp BEFORE UPDATE ON public.salon_shifts FOR EACH ROW EXECUTE FUNCTION public.update_salon_updated_at();


--
-- Name: salon_transactions update_salon_transactions_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salon_transactions_timestamp BEFORE UPDATE ON public.salon_transactions FOR EACH ROW EXECUTE FUNCTION public.update_salon_updated_at();


--
-- Name: salon_users update_salon_users_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salon_users_timestamp BEFORE UPDATE ON public.salon_users FOR EACH ROW EXECUTE FUNCTION public.update_salon_updated_at();


--
-- Name: booking_services booking_services_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_services booking_services_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: booking_services booking_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.service_customers(id) ON DELETE CASCADE;


--
-- Name: business_custom_category_names business_custom_category_names_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_custom_category_names
    ADD CONSTRAINT business_custom_category_names_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commission_settings commission_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_settings
    ADD CONSTRAINT commission_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: consultations consultations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: consultations consultations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: consultations consultations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: customer_assignments customer_assignments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_assignments
    ADD CONSTRAINT customer_assignments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: customer_assignments customer_assignments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_assignments
    ADD CONSTRAINT customer_assignments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: customer_assignments customer_assignments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_assignments
    ADD CONSTRAINT customer_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.service_customers(id) ON DELETE CASCADE;


--
-- Name: customer_assignments customer_assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_assignments
    ADD CONSTRAINT customer_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: customer_assignments customer_assignments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_assignments
    ADD CONSTRAINT customer_assignments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: damage_record_lines damage_record_lines_damage_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.damage_record_lines
    ADD CONSTRAINT damage_record_lines_damage_record_id_fkey FOREIGN KEY (damage_record_id) REFERENCES public.damage_records(id) ON DELETE CASCADE;


--
-- Name: damage_record_lines damage_record_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.damage_record_lines
    ADD CONSTRAINT damage_record_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: doctor_visits doctor_visits_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_visits
    ADD CONSTRAINT doctor_visits_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: doctor_visits doctor_visits_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_visits
    ADD CONSTRAINT doctor_visits_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: doctor_visits doctor_visits_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_visits
    ADD CONSTRAINT doctor_visits_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: doctor_visits doctor_visits_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_visits
    ADD CONSTRAINT doctor_visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: employee_commissions employee_commissions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_commissions
    ADD CONSTRAINT employee_commissions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_commissions employee_commissions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_commissions
    ADD CONSTRAINT employee_commissions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: goods_return_lines goods_return_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_return_lines
    ADD CONSTRAINT goods_return_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: goods_return_lines goods_return_lines_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_return_lines
    ADD CONSTRAINT goods_return_lines_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.goods_returns(id) ON DELETE CASCADE;


--
-- Name: goods_returns goods_returns_financial_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_returns
    ADD CONSTRAINT goods_returns_financial_account_id_fkey FOREIGN KEY (financial_account_id) REFERENCES public.financial_accounts(id);


--
-- Name: goods_returns goods_returns_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_returns
    ADD CONSTRAINT goods_returns_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: invoice_lines invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: invoice_lines invoice_lines_category_1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_category_1_id_fkey FOREIGN KEY (category_1_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: invoice_lines invoice_lines_category_2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_category_2_id_fkey FOREIGN KEY (category_2_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: invoice_lines invoice_lines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: invoice_payments invoice_payments_financial_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_financial_account_id_fkey FOREIGN KEY (financial_account_id) REFERENCES public.financial_accounts(id);


--
-- Name: invoice_payments invoice_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL;


--
-- Name: item_categories item_categories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_categories
    ADD CONSTRAINT item_categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: items items_category_1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_category_1_id_fkey FOREIGN KEY (category_1_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: items items_category_2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_category_2_id_fkey FOREIGN KEY (category_2_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: items items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: lab_tests lab_tests_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: lab_tests lab_tests_doctor_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_doctor_visit_id_fkey FOREIGN KEY (doctor_visit_id) REFERENCES public.doctor_visits(id) ON DELETE CASCADE;


--
-- Name: lab_tests lab_tests_lab_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_lab_technician_id_fkey FOREIGN KEY (lab_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lab_tests lab_tests_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: lab_tests lab_tests_served_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_served_by_fkey FOREIGN KEY (served_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mpesa_confirmations mpesa_confirmations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_confirmations
    ADD CONSTRAINT mpesa_confirmations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: mpesa_confirmations mpesa_confirmations_linked_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_confirmations
    ADD CONSTRAINT mpesa_confirmations_linked_invoice_id_fkey FOREIGN KEY (linked_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: patients patients_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: prescription_items prescription_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: prescription_items prescription_items_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_doctor_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_doctor_visit_id_fkey FOREIGN KEY (doctor_visit_id) REFERENCES public.doctor_visits(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_served_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_served_by_fkey FOREIGN KEY (served_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: quotation_lines quotation_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: quotation_lines quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotation_lines quotation_lines_category_1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_lines_category_1_id_fkey FOREIGN KEY (category_1_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: quotation_lines quotation_lines_category_2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_lines_category_2_id_fkey FOREIGN KEY (category_2_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: quotation_lines quotation_lines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_lines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.item_categories(id) ON DELETE SET NULL;


--
-- Name: quotations quotations_converted_to_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_converted_to_invoice_id_fkey FOREIGN KEY (converted_to_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: quotations quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: salon_employee_performance salon_employee_performance_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_employee_performance
    ADD CONSTRAINT salon_employee_performance_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_employee_performance salon_employee_performance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_employee_performance
    ADD CONSTRAINT salon_employee_performance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_product_usage salon_product_usage_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_product_usage
    ADD CONSTRAINT salon_product_usage_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.salon_products(id) ON DELETE CASCADE;


--
-- Name: salon_product_usage salon_product_usage_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_product_usage
    ADD CONSTRAINT salon_product_usage_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.salon_transactions(id) ON DELETE CASCADE;


--
-- Name: salon_products salon_products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_products
    ADD CONSTRAINT salon_products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_services salon_services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_services
    ADD CONSTRAINT salon_services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_shifts salon_shifts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_shifts
    ADD CONSTRAINT salon_shifts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_shifts salon_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_shifts
    ADD CONSTRAINT salon_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_transactions salon_transactions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_transactions
    ADD CONSTRAINT salon_transactions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_transactions salon_transactions_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_transactions
    ADD CONSTRAINT salon_transactions_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_transactions salon_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_transactions
    ADD CONSTRAINT salon_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_transactions salon_transactions_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_transactions
    ADD CONSTRAINT salon_transactions_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.salon_services(id) ON DELETE CASCADE;


--
-- Name: salon_transactions salon_transactions_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_transactions
    ADD CONSTRAINT salon_transactions_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.salon_shifts(id) ON DELETE SET NULL;


--
-- Name: salon_users salon_users_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_users
    ADD CONSTRAINT salon_users_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: salon_users salon_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_users
    ADD CONSTRAINT salon_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_customers service_customers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_customers
    ADD CONSTRAINT service_customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: service_invoice_lines service_invoice_lines_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoice_lines
    ADD CONSTRAINT service_invoice_lines_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: service_invoice_lines service_invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoice_lines
    ADD CONSTRAINT service_invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.service_invoices(id) ON DELETE CASCADE;


--
-- Name: service_invoice_lines service_invoice_lines_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoice_lines
    ADD CONSTRAINT service_invoice_lines_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_invoices service_invoices_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoices
    ADD CONSTRAINT service_invoices_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: service_invoices service_invoices_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoices
    ADD CONSTRAINT service_invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: service_invoices service_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_invoices
    ADD CONSTRAINT service_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.service_customers(id) ON DELETE CASCADE;


--
-- Name: services services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: users users_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict mIeSCGGy5Oet77Fj5TpCVXLNgWucutBHUIJI8u1aeCB7foDYYf44hOub6OCom3y

