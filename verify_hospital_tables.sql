-- Verification script to check if all hospital tables were created successfully

-- Check if all tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_name IN ('patients', 'consultations', 'doctor_visits', 'lab_tests', 'prescriptions', 'prescription_items')
ORDER BY table_name;

-- Check indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('patients', 'consultations', 'doctor_visits', 'lab_tests', 'prescriptions', 'prescription_items')
ORDER BY tablename, indexname;

-- Check triggers
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table IN ('patients', 'consultations', 'doctor_visits', 'lab_tests', 'prescriptions', 'prescription_items')
ORDER BY event_object_table, trigger_name;

