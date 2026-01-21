import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Principal profile using the service role (bypasses RLS).
 * Used after signUp because the client may not have a session yet (e.g. email confirmation).
 * Verifies the user exists and has user_type 'principal' before inserting.
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
    const {
      userId,
      firstName,
      lastName,
      email,
      middleName = '',
      contactNumber = '',
      address = '',
      districtSchoolName = '',
      typeOfSchool = '',
      typeOfStudents = [],
      pricingRegion = 'US',
    } = body;

    if (!userId || !firstName || !lastName || !email) {
      return Response.json(
        { error: 'Missing required fields: userId, firstName, lastName, email' },
        { status: 400 }
      );
    }

    // Verify user exists and is intended as principal
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      return Response.json({ error: 'User not found or invalid' }, { status: 404 });
    }
    if (authUser.user.email !== email) {
      return Response.json({ error: 'Email does not match the account' }, { status: 400 });
    }
    if (authUser.user.user_metadata?.user_type !== 'principal') {
      return Response.json({ error: 'Account is not a principal' }, { status: 400 });
    }

    // Check if principal profile already exists
    const { data: existing } = await supabase
      .from('Principals')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return Response.json({ success: true, id: existing.id });
    }

    const { data, error } = await supabase
      .from('Principals')
      .insert({
        user_id: userId,
        first_name: firstName || '',
        last_name: lastName || '',
        email,
        middle_name: middleName || '',
        contact_number: contactNumber || '',
        address: address || '',
        district_school_name: districtSchoolName || '',
        type_of_school: typeOfSchool || '',
        type_of_students: Array.isArray(typeOfStudents) ? typeOfStudents : [],
        pricing_region: pricingRegion === 'PH' ? 'PH' : 'US',
        students: [],
      })
      .select('id')
      .single();

    if (error) {
      console.error('create-principal-profile insert error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, id: data?.id });
  } catch (err) {
    console.error('create-principal-profile error:', err);
    return Response.json(
      { error: err.message || 'Failed to create principal profile' },
      { status: 500 }
    );
  }
}
