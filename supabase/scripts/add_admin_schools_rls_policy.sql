-- Add RLS policy to allow admins AND superadmins to read all schools data
-- This is needed for the AdminUsers component to display school counts for principals

BEGIN;

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can read all schools" ON public."Schools";

-- Create policy for admins AND superadmins to read all schools
CREATE POLICY "Admins can read all schools"
    ON public."Schools"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE admins.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.superadmins
            WHERE superadmins.user_id = auth.uid()
        )
    );

COMMIT;

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'Schools'
ORDER BY policyname;
