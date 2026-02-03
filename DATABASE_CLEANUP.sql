/**
 * Database Cleanup Script
 * 
 * This script helps clean up old student data that's still showing in the dropdown.
 * 
 * INSTRUCTIONS:
 * 1. Go to your Supabase dashboard
 * 2. Navigate to SQL Editor
 * 3. Run these queries one by one
 */

-- Step 1: Check what's currently in the Principals.students field
SELECT id, first_name, last_name, email, students 
FROM "Principals" 
WHERE students IS NOT NULL AND students != '[]'::jsonb;

-- Step 2: Clear the students field (if not already cleared)
UPDATE "Principals" 
SET students = '[]'::jsonb 
WHERE students IS NOT NULL AND students != '[]'::jsonb;

-- Step 3: Check if there are Student records that were created for the principal
-- (These are the ones showing up as "ian dev" and "Danna Pajarin")
SELECT s.id, s.first_name, s.last_name, s.email, s.user_id, s.created_at
FROM "Students" s
WHERE s.first_name IN ('ian', 'Danna') OR s.last_name IN ('dev', 'Pajarin')
ORDER BY s.created_at DESC;

-- Step 4: OPTIONAL - Delete these student records if they're no longer needed
-- WARNING: Only run this if you're sure you want to delete these students!
-- Uncomment the line below to delete:
-- DELETE FROM "Students" WHERE id IN (SELECT id FROM "Students" WHERE first_name IN ('ian', 'Danna') OR last_name IN ('dev', 'Pajarin'));

-- Step 5: Verify schools exist for the principal
SELECT s.id, s.name, s.principal_id, s.school_type, s.created_at
FROM "Schools" s
ORDER BY s.created_at DESC
LIMIT 20;

-- Step 6: Check the relationship between principals and schools
SELECT p.id as principal_id, p.first_name || ' ' || p.last_name as principal_name,
       COUNT(s.id) as school_count,
       STRING_AGG(s.name, ', ') as school_names
FROM "Principals" p
LEFT JOIN "Schools" s ON s.principal_id = p.user_id
GROUP BY p.id, p.first_name, p.last_name;

/**
 * AFTER RUNNING THESE QUERIES:
 * 
 * 1. Refresh your browser (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
 * 2. Log out and log back in
 * 3. The dropdown should now show schools instead of students
 * 
 * If schools don't appear:
 * - Make sure schools exist in the Schools table
 * - Make sure the principal_id in Schools matches the user_id in Principals
 * - Check browser console for any errors
 */
