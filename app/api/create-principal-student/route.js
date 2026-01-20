import { createClient } from '@supabase/supabase-js';

/**
 * Creates a new Student profile (no auth account) for a principal to manage.
 * Principal can add unlimited such profiles. The student has user_id=null
 * and is managed via "View as student" by the principal.
 * Requires: the request body's userId to belong to a Principal.
 */
export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: 'Server misconfiguration: missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { userId, firstName, lastName, email } = body;

    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 400 });
    }

    const fName = typeof firstName === 'string' ? firstName.trim() : '';
    const lName = typeof lastName === 'string' ? lastName.trim() : '';
    if (!fName && !lName) {
      return Response.json(
        { error: 'At least first name or last name is required' },
        { status: 400 }
      );
    }

    // Ensure the user is a principal
    const { data: principal, error: principalErr } = await supabase
      .from('Principals')
      .select('id, students')
      .eq('user_id', userId)
      .maybeSingle();

    if (principalErr || !principal) {
      return Response.json({ error: 'Only principals can create student profiles' }, { status: 403 });
    }

    // Principals can always add multiple profiles by default, so set has_family_pack = true
    // This allows principals to manage multiple student profiles without purchasing a family pack
    const hasFamilyPack = true;

    const { data: row, error } = await supabase
      .from('Students')
      .insert({
        user_id: null,
        first_name: fName || null,
        last_name: lName || null,
        email: (email && typeof email === 'string' && email.trim()) ? email.trim() : null,
        credits: 0,
        extra_profiles: [],
        has_family_pack: hasFamilyPack,
      })
      .select('id, first_name, last_name, email')
      .single();

    if (error) {
      console.error('create-principal-student insert error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      id: row.id,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      email: row.email || '',
    });
  } catch (err) {
    console.error('create-principal-student error:', err);
    return Response.json(
      { error: err.message || 'Failed to create student profile' },
      { status: 500 }
    );
  }
}
