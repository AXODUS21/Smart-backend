import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: 'Missing Supabase credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const sql = `
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      DECLARE
      user_first_name TEXT;
      user_last_name TEXT;
      user_type TEXT;
      user_pricing_region TEXT;
      BEGIN
      -- Get user metadata
      user_first_name := NEW.raw_user_meta_data->>'first_name';
      user_last_name := NEW.raw_user_meta_data->>'last_name';
      user_type := NEW.raw_user_meta_data->>'user_type';
      user_pricing_region := NEW.raw_user_meta_data->>'pricing_region';
      
      -- If names are not provided, use empty strings
      IF user_first_name IS NULL THEN
          user_first_name := '';
      END IF;
      IF user_last_name IS NULL THEN
          user_last_name := '';
      END IF;
      IF user_pricing_region IS NULL THEN
          user_pricing_region := 'US';
      END IF;
      
      -- Create profile based on user_type
      IF user_type = 'student' THEN
          INSERT INTO public."Students" (user_id, first_name, last_name, email, credits, pricing_region)
          VALUES (NEW.id, user_first_name, user_last_name, NEW.email, 0, user_pricing_region)
          ON CONFLICT (user_id) DO NOTHING;
      ELSIF user_type = 'tutor' THEN
          INSERT INTO public."Tutors" (user_id, first_name, last_name, email, subjects, application_status, pricing_region)
          VALUES (NEW.id, user_first_name, user_last_name, NEW.email, '[]'::jsonb, false, user_pricing_region)
          ON CONFLICT (user_id) DO NOTHING;
      END IF;
      
      RETURN NEW;
      EXCEPTION
      WHEN OTHERS THEN
          -- Log the error but don't fail the user creation
          RAISE WARNING 'Error creating user profile: %', SQLERRM;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Supabase JS doesn't have a direct raw SQL execute via rest API if not using rpc, 
    // but we can try to use it if there's a generic rpc or just output the SQL for the user.
    // Actually, maybe we can just create an RPC function using migrations, but we can't do that either.
    return Response.json({ 
      error: 'Cannot execute raw SQL directly via Supabase JS client',
      sql 
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
