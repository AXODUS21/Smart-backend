-- Fix RLS: allow authenticated users to insert their own Principal profile on signup
-- Run in Supabase SQL Editor if not applied via MCP
CREATE POLICY "Users can insert own principal profile"
  ON public."Principals"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
