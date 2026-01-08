import { supabase } from './supabase';

/**
 * Ensure a profile row exists for the given user and role.
 * `extra` allows role-specific fields to be persisted.
 * Returns the created or existing profile id when possible.
 */
export async function ensureUserProfile(
  userId,
  firstName,
  lastName,
  email,
  userType,
  extra = {}
) {
  try {
    if (userType === 'student') {
      const { data: existingStudent } = await supabase
        .from('Students')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingStudent) return existingStudent.id;

      const { data, error } = await supabase
        .from('Students')
        .insert({
          user_id: userId,
          first_name: firstName || '',
          last_name: lastName || '',
          email,
          credits: 0,
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    }

    if (userType === 'tutor') {
      const { data: existingTutor } = await supabase
        .from('Tutors')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingTutor) return existingTutor.id;

      const { data, error } = await supabase
        .from('Tutors')
        .insert({
          user_id: userId,
          first_name: firstName || '',
          last_name: lastName || '',
          email,
          subjects: [],
          application_status: false,
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    }

    if (userType === 'principal') {
      const { data: existingPrincipal } = await supabase
        .from('Principals')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingPrincipal) return existingPrincipal.id;

      const { data, error } = await supabase
        .from('Principals')
        .insert({
          user_id: userId,
          first_name: firstName || '',
          last_name: lastName || '',
          email,
          pricing_region: extra.pricing_region || 'US',
          students: [],
          middle_name: extra.middle_name || '',
          contact_number: extra.contact_number || '',
          address: extra.address || '',
          district_school_name: extra.district_school_name || '',
          type_of_school: extra.type_of_school || '',
          type_of_students: extra.type_of_students || [],
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    }

    return null;
  } catch (err) {
    console.error('Error ensuring user profile:', err);
    throw err;
  }
}






















