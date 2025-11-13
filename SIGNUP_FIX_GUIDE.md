# Fix: "Database error saving new user" on Signup

## Problem
When signing up a new account, you're getting a "Database error saving new user" error. This happens because the database trigger that automatically creates a profile record in the `Students` or `Tutors` table is either missing or failing.

## Solution

### Step 1: Run Diagnostic Queries
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `diagnose_user_signup.sql`
4. Run the queries to check:
   - If the trigger exists
   - Table structures
   - RLS (Row Level Security) policies
   - Recent user signups

### Step 2: Apply the Fix
1. In the Supabase SQL Editor, copy and paste the contents of `create_user_profile_trigger.sql`
2. Run the SQL script to create the trigger function and trigger

### Step 3: Verify the Fix
1. Try signing up a new user again
2. Check if a record was created in the `Students` or `Tutors` table

## Common Issues and Solutions

### Issue 1: RLS Policies Blocking Inserts
If RLS is enabled on `Students` or `Tutors` tables, you need to ensure the trigger can insert records. The trigger function uses `SECURITY DEFINER` which should bypass RLS, but you may need to add a policy:

```sql
-- Allow the trigger function to insert into Students
CREATE POLICY "Allow trigger to insert students"
ON public."Students"
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow the trigger function to insert into Tutors
CREATE POLICY "Allow trigger to insert tutors"
ON public."Tutors"
FOR INSERT
TO service_role
WITH CHECK (true);
```

### Issue 2: Missing Required Columns
If your `Students` or `Tutors` tables have NOT NULL columns without defaults, the trigger might fail. Check the diagnostic queries to see which columns are required.

### Issue 3: Table Names Case Sensitivity
Make sure your table names match exactly:
- `Students` (with capital S)
- `Tutors` (with capital T)

If your tables are lowercase (`students`, `tutors`), update the trigger SQL accordingly.

### Issue 4: Unique Constraint on user_id
The trigger uses `ON CONFLICT (user_id) DO NOTHING` to prevent duplicate inserts. Make sure your tables have a unique constraint or primary key on `user_id`:

```sql
-- Check if unique constraint exists
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name IN ('Students', 'Tutors')
  AND constraint_type = 'UNIQUE';

-- If missing, add unique constraint
ALTER TABLE public."Students" ADD CONSTRAINT students_user_id_unique UNIQUE (user_id);
ALTER TABLE public."Tutors" ADD CONSTRAINT tutors_user_id_unique UNIQUE (user_id);
```

## Testing

After applying the fix, test by:
1. Signing up a new student account
2. Signing up a new tutor account
3. Verifying records are created in the respective tables

## Need More Help?

If the issue persists:
1. Check the Supabase logs in the Dashboard under **Logs** > **Postgres Logs**
2. Look for error messages related to the trigger function
3. Verify that the `user_type` metadata is being set correctly during signup (should be 'student' or 'tutor')

