-- Manual GCash top-up requests (receipt handled via Messenger)
-- Student initiates request; admin/superadmin approves and credits are added manually in-app.

CREATE TABLE IF NOT EXISTS public.manual_topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id text,
  plan_name text,
  credits integer NOT NULL CHECK (credits > 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'php',
  reference_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid
);

CREATE INDEX IF NOT EXISTS manual_topup_requests_status_idx ON public.manual_topup_requests(status);
CREATE INDEX IF NOT EXISTS manual_topup_requests_reference_code_idx ON public.manual_topup_requests(reference_code);
CREATE INDEX IF NOT EXISTS manual_topup_requests_user_id_idx ON public.manual_topup_requests(user_id);

-- Optional RLS (recommended). Service role bypasses; if you rely on client queries, add policies.
ALTER TABLE public.manual_topup_requests ENABLE ROW LEVEL SECURITY;

-- Students can create their own requests.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_topup_requests'
      AND policyname = 'Students can insert own topup request'
  ) THEN
    CREATE POLICY "Students can insert own topup request"
      ON public.manual_topup_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Students can view their own requests.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_topup_requests'
      AND policyname = 'Students can select own topup request'
  ) THEN
    CREATE POLICY "Students can select own topup request"
      ON public.manual_topup_requests
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

