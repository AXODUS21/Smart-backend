import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for admin operations
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  
  return createClient(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * Get email addresses for users by role
 * @param {string|string[]} roles - Role(s) to fetch: 'student', 'tutor', 'admin', 'superadmin'
 * @param {object} options - Additional filters
 * @returns {Promise<string[]>} Array of email addresses
 */
export async function getUserEmailsByRole(roles, options = {}) {
  const supabase = getSupabaseClient();
  const roleArray = Array.isArray(roles) ? roles : [roles];
  const emails = [];

  try {
    for (const role of roleArray) {
      switch (role) {
        case 'student':
          const { data: students, error: studentError } = await supabase
            .from('Students')
            .select('email')
            .not('email', 'is', null);
          
          if (!studentError && students) {
            emails.push(...students.map(s => s.email).filter(Boolean));
          }
          break;

        case 'tutor':
          const { data: tutors, error: tutorError } = await supabase
            .from('Tutors')
            .select('email')
            .not('email', 'is', null);
          
          if (!tutorError && tutors) {
            emails.push(...tutors.map(t => t.email).filter(Boolean));
          }
          break;

        case 'admin':
          const { data: admins, error: adminError } = await supabase
            .from('admins')
            .select('email')
            .not('email', 'is', null);
          
          if (!adminError && admins) {
            emails.push(...admins.map(a => a.email).filter(Boolean));
          }
          break;

        case 'superadmin':
          const { data: superadmins, error: superadminError } = await supabase
            .from('superadmins')
            .select('email')
            .not('email', 'is', null);
          
          if (!superadminError && superadmins) {
            emails.push(...superadmins.map(sa => sa.email).filter(Boolean));
          }
          break;
      }
    }

    // Remove duplicates
    return [...new Set(emails)];
  } catch (error) {
    console.error('Error fetching user emails by role:', error);
    return [];
  }
}

/**
 * Get email address for a specific user by ID and role
 * @param {string} userId - User ID
 * @param {string} role - Role: 'student', 'tutor', 'admin', 'superadmin'
 * @returns {Promise<string|null>} Email address or null
 */
export async function getUserEmailById(userId, role) {
  const supabase = getSupabaseClient();

  try {
    switch (role) {
      case 'student':
        const { data: student } = await supabase
          .from('Students')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle();
        return student?.email || null;

      case 'tutor':
        const { data: tutor } = await supabase
          .from('Tutors')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle();
        return tutor?.email || null;

      case 'admin':
        const { data: admin } = await supabase
          .from('admins')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle();
        return admin?.email || null;

      case 'superadmin':
        const { data: superadmin } = await supabase
          .from('superadmins')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle();
        return superadmin?.email || null;

      default:
        return null;
    }
  } catch (error) {
    console.error('Error fetching user email by ID:', error);
    return null;
  }
}

/**
 * Get email addresses for specific users by IDs
 * @param {string[]} userIds - Array of user IDs
 * @param {string} role - Role: 'student', 'tutor', 'admin', 'superadmin'
 * @returns {Promise<string[]>} Array of email addresses
 */
export async function getUserEmailsByIds(userIds, role) {
  const supabase = getSupabaseClient();
  const emails = [];

  try {
    if (!userIds || userIds.length === 0) return [];

    let tableName;
    switch (role) {
      case 'student':
        tableName = 'Students';
        break;
      case 'tutor':
        tableName = 'Tutors';
        break;
      case 'admin':
        tableName = 'admins';
        break;
      case 'superadmin':
        tableName = 'superadmins';
        break;
      default:
        return [];
    }

    const { data: users, error } = await supabase
      .from(tableName)
      .select('email')
      .in('user_id', userIds)
      .not('email', 'is', null);

    if (!error && users) {
      emails.push(...users.map(u => u.email).filter(Boolean));
    }

    return emails;
  } catch (error) {
    console.error('Error fetching user emails by IDs:', error);
    return [];
  }
}

/**
 * Get student email by student ID (not user_id)
 * @param {number} studentId - Student ID from Students table
 * @returns {Promise<string|null>} Email address or null
 */
export async function getStudentEmailById(studentId) {
  const supabase = getSupabaseClient();
  
  try {
    const { data: student } = await supabase
      .from('Students')
      .select('email')
      .eq('id', studentId)
      .maybeSingle();
    
    return student?.email || null;
  } catch (error) {
    console.error('Error fetching student email by ID:', error);
    return null;
  }
}

/**
 * Get tutor email by tutor ID (not user_id)
 * @param {number} tutorId - Tutor ID from Tutors table
 * @returns {Promise<string|null>} Email address or null
 */
export async function getTutorEmailById(tutorId) {
  const supabase = getSupabaseClient();
  
  try {
    const { data: tutor } = await supabase
      .from('Tutors')
      .select('email')
      .eq('id', tutorId)
      .maybeSingle();
    
    return tutor?.email || null;
  } catch (error) {
    console.error('Error fetching tutor email by ID:', error);
    return null;
  }
}

