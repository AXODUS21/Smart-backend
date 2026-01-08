import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        persistSession: false,
      },
    }
  );
}

// POST /api/admin/withdrawals/approve - Approve or reject withdrawal
export async function POST(request) {
  try {
    const { withdrawalId, action, superadminId, rejectionReason } = await request.json();

    if (!withdrawalId || !action || !superadminId) {
      return NextResponse.json(
        { error: 'Missing required fields: withdrawalId, action, superadminId' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejectionReason?.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get current withdrawal status
    const { data: withdrawal, error: fetchError } = await supabase
      .from('TutorWithdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (fetchError || !withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { error: `Withdrawal is already ${withdrawal.status}` },
        { status: 400 }
      );
    }

    // Update withdrawal status
    if (action === 'approve') {
      const { error: updateError } = await supabase
        .from('TutorWithdrawals')
        .update({
          status: 'approved',
          approved_by: superadminId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', withdrawalId);

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to approve withdrawal: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Withdrawal approved successfully',
      });
    } else if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('TutorWithdrawals')
        .update({
          status: 'rejected',
          rejected_by: superadminId,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', withdrawalId);

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to reject withdrawal: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Withdrawal rejected successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in withdrawal approval:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process approval/rejection' },
      { status: 500 }
    );
  }
}

