import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const designType = searchParams.get('design_type');
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({
        designs: [],
        success: true
      });
    }

    // Get the authorization header (contains the user's session token)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    let query = supabase
      .from('coterm_calculations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (designType) {
      query = query.eq('design_type', designType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      designs: data || [],
      success: true
    });
  } catch (error) {
    console.error('Get designs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch designs' },
      { status: 500 }
    );
  }
}
