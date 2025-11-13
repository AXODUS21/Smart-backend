-- Diagnostic queries to check why user signup might be failing

-- 1. Check if the trigger function exists
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 2. Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 3. Check Students table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'Students'
ORDER BY ordinal_position;

-- 4. Check Tutors table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'Tutors'
ORDER BY ordinal_position;

-- 5. Check RLS policies on Students table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'Students';

-- 6. Check RLS policies on Tutors table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'Tutors';

-- 7. Check if RLS is enabled on Students table
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'Students';

-- 8. Check if RLS is enabled on Tutors table
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'Tutors';

-- 9. Check recent auth.users to see if they have metadata
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 10. Check if there are any Students without corresponding auth.users (orphaned records)
SELECT s.id, s.user_id, s.name, s.email
FROM public."Students" s
LEFT JOIN auth.users u ON s.user_id = u.id
WHERE u.id IS NULL
LIMIT 10;

-- 11. Check if there are any Tutors without corresponding auth.users (orphaned records)
SELECT t.id, t.user_id, t.name, t.email
FROM public."Tutors" t
LEFT JOIN auth.users u ON t.user_id = u.id
WHERE u.id IS NULL
LIMIT 10;

