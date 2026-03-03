-- Add RLS policy to allow admins AND superadmins to read all principals data
-- This is needed for the AdminUsers component to display principals

BEGIN;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can read all principals" ON public."Principals";
DROP POLICY IF EXISTS "Admins can update all principals" ON public."Principals";
DROP POLICY IF EXISTS "Superadmins can read all principals" ON public."Principals";

-- Create policy for admins AND superadmins to read all principals
CREATE POLICY "Admins can read all principals"
    ON public."Principals"
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

-- Create policy for admins AND superadmins to update principals
CREATE POLICY "Admins can update all principals"
    ON public."Principals"
    FOR UPDATE
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
WHERE tablename = 'Principals'
ORDER BY policyname;
