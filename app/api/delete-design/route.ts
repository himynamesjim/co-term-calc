import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { design_id } = body;

    if (!design_id) {
      return NextResponse.json(
        { error: 'Design ID is required' },
        { status: 400 }
      );
    }

    // Get the authorization header (contains the user's session token)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    const { error } = await supabase
      .from('coterm_calculations')
      .delete()
      .eq('id', design_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Design deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete design API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete design', details: error.message },
      { status: 500 }
    );
  }
}
