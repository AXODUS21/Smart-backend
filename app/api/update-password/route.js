import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  const { email, newPassword } = await request.json();
  
  try {
    // Initialize Supabase with service role key
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

    // Get the user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email === email);
    if (!user) {
      throw new Error('User not found');
    }

    // Update the password
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Password updated successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating password:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to update password',
      details: error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
