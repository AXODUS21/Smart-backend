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
        .select('id, pricing_region')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingStudent) {
        if (extra.pricing_region && existingStudent.pricing_region !== extra.pricing_region) {
          await supabase.from('Students').update({ pricing_region: extra.pricing_region }).eq('id', existingStudent.id);
        }
        return existingStudent.id;
      }

      const { data, error } = await supabase
        .from('Students')
        .insert({
          user_id: userId,
          first_name: firstName || '',
          last_name: lastName || '',
          email,
          credits: 0,
          pricing_region: extra.pricing_region || 'US',
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    }

    if (userType === 'tutor') {
      const { data: existingTutor } = await supabase
        .from('Tutors')
        .select('id, pricing_region')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingTutor) {
        if (extra.pricing_region && existingTutor.pricing_region !== extra.pricing_region) {
          await supabase.from('Tutors').update({ pricing_region: extra.pricing_region }).eq('id', existingTutor.id);
        }
        return existingTutor.id;
      }

      const { data, error } = await supabase
        .from('Tutors')
        .insert({
          user_id: userId,
          first_name: firstName || '',
          last_name: lastName || '',
          email,
          subjects: [],
          application_status: false,
          pricing_region: extra.pricing_region || 'US',
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;
      return data?.id ?? null;
    }

    if (userType === 'principal') {
      const { data: existingPrincipal } = await supabase
        .from('Principals')
        .select('id, pricing_region')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingPrincipal) {
        if (extra.pricing_region && existingPrincipal.pricing_region !== extra.pricing_region) {
          await supabase.from('Principals').update({ pricing_region: extra.pricing_region }).eq('id', existingPrincipal.id);
        }
        return existingPrincipal.id;
      }

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






















