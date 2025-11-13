-- This script creates missing profiles for users who signed up but don't have records in Students/Tutors tables
-- Run this in Supabase SQL Editor to fix existing users

-- Fix students who don't have profiles
INSERT INTO public."Students" (user_id, name, email, credits)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', u.email) as name,
  u.email,
  0 as credits
FROM auth.users u
WHERE u.raw_user_meta_data->>'user_type' = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public."Students" s WHERE s.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Fix tutors who don't have profiles
INSERT INTO public."Tutors" (user_id, name, email, subjects, application_status)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', u.email) as name,
  u.email,
  '[]'::jsonb as subjects,
  false as application_status
FROM auth.users u
WHERE u.raw_user_meta_data->>'user_type' = 'tutor'
  AND NOT EXISTS (
    SELECT 1 FROM public."Tutors" t WHERE t.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Check how many users were fixed
SELECT 
  'Students created' as type,
  COUNT(*) as count
FROM public."Students" s
INNER JOIN auth.users u ON s.user_id = u.id
WHERE u.raw_user_meta_data->>'user_type' = 'student'
UNION ALL
SELECT 
  'Tutors created' as type,
  COUNT(*) as count
FROM public."Tutors" t
INNER JOIN auth.users u ON t.user_id = u.id
WHERE u.raw_user_meta_data->>'user_type' = 'tutor';

