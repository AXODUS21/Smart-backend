# Migration Guide: Full Name to First Name and Last Name

This guide explains how to migrate from using a single `name` field to separate `first_name` and `last_name` fields in the Supabase database.

## Steps to Complete the Migration

### Step 1: Run the Database Migration Script

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `migrate_name_to_first_last_name.sql`
4. Run the script to:
   - Add `first_name` and `last_name` columns to both `Students` and `Tutors` tables
   - Migrate existing data by splitting the existing `name` field

### Step 2: Update the Database Trigger

1. In the Supabase SQL Editor, copy and paste the contents of `create_user_profile_trigger.sql`
2. Run the script to update the trigger function to use `first_name` and `last_name` instead of `name`

### Step 3: Verify the Migration

1. Check that existing users have their names properly split:

   ```sql
   SELECT id, first_name, last_name, email FROM "Students" LIMIT 10;
   SELECT id, first_name, last_name, email FROM "Tutors" LIMIT 10;
   ```

2. Test creating a new user account to ensure the trigger works correctly

### Step 4: (Optional) Remove the Old `name` Column

After verifying everything works correctly, you can remove the old `name` column:

```sql
-- Uncomment these lines in migrate_name_to_first_last_name.sql and run them
ALTER TABLE public."Students" DROP COLUMN IF EXISTS name;
ALTER TABLE public."Tutors" DROP COLUMN IF EXISTS name;
```

**Important:** Only do this after you've verified that all existing data has been migrated and the application is working correctly.

## What Has Been Updated

### Frontend Changes

- ✅ Signup form now has separate First Name and Last Name fields
- ✅ All components updated to use `first_name` and `last_name`
- ✅ Display logic updated to combine first and last names where needed

### Database Changes

- ✅ Migration script created to add new columns and migrate data
- ✅ Trigger function updated to use new field structure

### Components Updated

- `app/login/page.js` - Signup form and user profile creation
- `components/Dashboard.js` - User name display
- `components/dashboard/StudentHome.js` - Student name display
- `components/dashboard/TutorHome.js` - Tutor name display
- `components/dashboard/TutorProfile.js` - Tutor profile display
- `components/dashboard/TutorApplication.js` - Application form
- `components/dashboard/BookSession.js` - Tutor selection
- `components/dashboard/AdminDashboard.js` - Admin dashboard displays
- `components/dashboard/TutorAssignments.js` - Student name references

## Notes

- The migration script splits existing names on the first space character
- If a name has no space, it will be stored entirely in `first_name` with `last_name` being empty
- The application code handles cases where names might be empty or missing
- All name displays now combine `first_name` and `last_name` with proper fallbacks
