import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// GET /api/superadmin/payout-reports - List all payout reports
export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (reportId) {
      // Get specific report
      const { data: report, error } = await supabase
        .from('PayoutReports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ report });
    }

    // Get all reports (paginated)
    const { data: reports, error, count } = await supabase
      .from('PayoutReports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reports: reports || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching payout reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payout reports' },
      { status: 500 }
    );
  }
}

// DELETE /api/superadmin/payout-reports - Delete a report
export async function DELETE(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId) {
       return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('PayoutReports')
      .delete()
      .eq('id', reportId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payout report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete report' },
      { status: 500 }
    );
  }
}
