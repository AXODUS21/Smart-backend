    -- Database Migration: Add session management fields to Schedules table
    -- Run this SQL in your Supabase SQL editor to add the necessary fields for past sessions functionality

    -- Add new columns to the Schedules table
    ALTER TABLE "Schedules" 
    ADD COLUMN IF NOT EXISTS "session_status" text DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS "session_action" text,
    ADD COLUMN IF NOT EXISTS "tutor_review" text;

    -- Add comments to document the purpose of each field
    COMMENT ON COLUMN "Schedules"."session_status" IS 'Status of the completed session: completed, student-no-show, tutor-no-show, successful';
    COMMENT ON COLUMN "Schedules"."session_action" IS 'Action taken by tutor: successful, student-no-show, tutor-no-show, review-submitted';
    COMMENT ON COLUMN "Schedules"."tutor_review" IS 'Review text provided by tutor after successful session';

    -- Optional: Add a check constraint to ensure valid session_status values
    ALTER TABLE "Schedules" 
    ADD CONSTRAINT "valid_session_status" 
    CHECK ("session_status" IN ('completed', 'student-no-show', 'tutor-no-show', 'successful'));

    -- Optional: Add a check constraint to ensure valid session_action values  
    ALTER TABLE "Schedules"
    ADD CONSTRAINT "valid_session_action"
    CHECK ("session_action" IN ('successful', 'student-no-show', 'tutor-no-show', 'review-submitted') OR "session_action" IS NULL);

    -- Update existing confirmed sessions that have ended to have 'completed' status
    UPDATE "Schedules" 
    SET "session_status" = 'completed'
    WHERE "status" = 'confirmed' 
    AND "end_time_utc" < NOW();
