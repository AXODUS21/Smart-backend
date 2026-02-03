/**
 * Migration Plan: Replace Student Profiles with School Profiles for Principals
 * 
 * OVERVIEW:
 * Replace the individual student profiles system with a school-based system where
 * each school from PrincipalSchools acts as a "student account" for booking sessions.
 * 
 * CHANGES NEEDED:
 * 
 * 1. DATABASE CHANGES:
 *    - Clear the 'students' array from Principals table
 *    - Schools table already exists and is being used
 *    - Each school will now function as a student profile
 * 
 * 2. COMPONENT CHANGES:
 *    a) PrincipalStudents.js → Deprecated (replace with school selection)
 *    b) Principal Dashboard → Use schools instead of students
 *    c) BookSession.js → Allow selecting school instead of student
 *    d) All student-related views → Filter by school_id instead of student_id
 * 
 * 3. DATA FLOW:
 *    - Principal adds schools in PrincipalSchools.js
 *    - When booking a session, select a school (not a student)
 *    - Sessions are linked to school_id
 *    - Principal views sessions filtered by school
 * 
 * IMPLEMENTATION STEPS:
 * 
 * Step 1: Clear existing students from Principals table
 *   SQL: UPDATE "Principals" SET students = '[]'::jsonb WHERE students IS NOT NULL;
 * 
 * Step 2: Modify PrincipalStudents.js to show schools instead
 *   - Fetch from Schools table instead of students array
 *   - Display schools with their details
 *   - Remove "Add Student" functionality (use PrincipalSchools instead)
 * 
 * Step 3: Update booking flow
 *   - In BookSession.js, when principal is logged in, show school selector
 *   - Store school_id in Schedules table (add new column if needed)
 * 
 * Step 4: Update all views to filter by school
 *   - StudentHome.js → Filter sessions by school_id
 *   - Meetings.js → Show school name instead of student name
 *   - SessionManagement.js → Filter by school_id
 * 
 * FILES TO MODIFY:
 * 1. components/dashboard/PrincipalStudents.js
 * 2. components/dashboard/BookSession.js
 * 3. components/dashboard/StudentHome.js
 * 4. components/dashboard/Meetings.js
 * 5. Database: Add school_id column to Schedules table
 */

// SQL to clear existing students
const clearStudentsSQL = `
UPDATE "Principals" 
SET students = '[]'::jsonb 
WHERE students IS NOT NULL AND students != '[]'::jsonb;
`;

// SQL to add school_id to Schedules table (if not exists)
const addSchoolIdColumnSQL = `
ALTER TABLE "Schedules" 
ADD COLUMN IF NOT EXISTS school_id bigint REFERENCES "Schools"(id);

CREATE INDEX IF NOT EXISTS idx_schedules_school_id ON "Schedules"(school_id);
`;

export { clearStudentsSQL, addSchoolIdColumnSQL };
