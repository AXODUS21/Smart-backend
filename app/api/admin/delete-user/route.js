import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { userId } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User ID required' }), { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401 });
    }

    const adminId = authUser.id;

    // Verify adminId is actually an admin or superadmin
    const [adminCheck, superAdminCheck] = await Promise.all([
      supabase.from('admins').select('id').eq('user_id', adminId).maybeSingle(),
      supabase.from('superadmins').select('id').eq('user_id', adminId).maybeSingle()
    ]);

    const isAdmin = !!adminCheck.data;
    const isSuperAdmin = !!superAdminCheck.data;

    if (!isAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Access restricted to Admins and Superadmins' }), { status: 403 });
    }

    // Check target user's roles
    const [targetAdminCheck, targetSuperAdminCheck] = await Promise.all([
      supabase.from('admins').select('id').eq('user_id', userId).maybeSingle(),
      supabase.from('superadmins').select('id').eq('user_id', userId).maybeSingle()
    ]);

    const targetIsAdmin = !!targetAdminCheck.data;
    const targetIsSuperAdmin = !!targetSuperAdminCheck.data;

    // Strict role segregation rules:
    if (isSuperAdmin && !targetIsAdmin && !targetIsSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Superadmins can only delete Admins and Superadmins. Please ask a normal Admin to manage Students/Tutors/Principals.' }), { status: 403 });
    }

    if (!isSuperAdmin && isAdmin && (targetIsAdmin || targetIsSuperAdmin)) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Only Superadmins can delete other Admins and Superadmins.' }), { status: 403 });
    }

    // Attempt to delete auth user. This cascades to other tables typically, or we can just delete it in auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
       // if the user doesn't exist in auth, maybe they still exist in the public role table. But usually it's best to delete them from auth.
       console.error("Error deleting auth user:", deleteError);
       // we continue to at least return an error to client if it completely fails
       if (!deleteError.message.includes('User not found')) {
         throw deleteError;
       }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User deleted successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to delete user',
      details: error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
