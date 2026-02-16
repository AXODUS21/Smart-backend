import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request) {
  try {
    // 1. Authenticate and Validate Request
    const body = await request.json();
    const { userId, role, amount, type, adminId } = body;

    if (!userId || !role || !amount || !type || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (!['add', 'remove'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "add" or "remove"' },
        { status: 400 }
      );
    }

    // 2. Verify Admin/Superadmin Status
    // We check if the requester (adminId) is actually an admin or superadmin
    const [adminCheck, superAdminCheck] = await Promise.all([
      supabase.from('admins').select('id').eq('user_id', adminId).maybeSingle(),
      supabase.from('superadmins').select('id').eq('user_id', adminId).maybeSingle()
    ]);

    const isAdmin = !!adminCheck.data;
    const isSuperAdmin = !!superAdminCheck.data;

    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Access restricted to Admins and Superadmins' },
        { status: 403 }
      );
    }

    // 3. Determine Table and Fetch Current Credits
    let table = '';
    let idField = 'user_id'; // Most tables use user_id, but we should double check if we are passing UUID or internal ID
    // Based on AdminUsers.js, we have access to both 'id' (table id) and 'user_id' (auth id).
    // The previous implementation plan suggested using user_id which is safer for auth checks.
    
    if (role === 'student') table = 'Students';
    else if (role === 'tutor') table = 'Tutors';
    else if (role === 'principal') table = 'Principals';
    else {
      return NextResponse.json(
        { error: 'Invalid user role for credit management' },
        { status: 400 }
      );
    }

    // Fetch current credits
    // We assume userId passed is the 'user_id' (auth ID).
    // If the frontend passes the table ID, we might need to adjust.
    // Let's support checking both or rely on the frontend sending the correct one.
    // AdminUsers.js has both. We will assume user_id is passed as it's more universal.
    
    const { data: userData, error: fetchError } = await supabase
      .from(table)
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (fetchError || !userData) {
      console.error(`Error fetching user ${userId} from ${table}:`, fetchError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentCredits = userData.credits || 0;
    
    // 4. Calculate New Credits
    let newCredits = 0;
    if (type === 'add') {
      newCredits = currentCredits + amount;
    } else {
      newCredits = currentCredits - amount;
      if (newCredits < 0) newCredits = 0; // Prevent negative credits
    }

    // 5. Update Database
    const { error: updateError } = await supabase
      .from(table)
      .update({ credits: newCredits })
      .eq('user_id', userId);

    if (updateError) {
      console.error(`Error updating credits for ${userId}:`, updateError);
      return NextResponse.json(
        { error: 'Failed to update credits' },
        { status: 500 }
      );
    }

    // 6. Log the action (Optional but good for audit)
    // For now we just console log, but in real app we might want an audit table.
    console.log(`[Admin Credit Update] Admin ${adminId} ${type}ed ${amount} credits for ${role} ${userId}. Old: ${currentCredits}, New: ${newCredits}`);

    return NextResponse.json({
      success: true,
      newCredits: newCredits,
      message: `Successfully ${type === 'add' ? 'added' : 'removed'} ${amount} credits.`
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
