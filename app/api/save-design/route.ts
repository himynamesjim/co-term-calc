import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, designData, designType = 'coterm-calc', userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
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

    // Check if a design with this title already exists for this user
    const { data: existing, error: fetchError } = await supabase
      .from('coterm_calculations')
      .select('*')
      .eq('user_id', userId)
      .eq('title', title)
      .eq('design_type', designType)
      .single();

    if (existing && !fetchError) {
      // Update existing design
      const { data, error } = await supabase
        .from('coterm_calculations')
        .update({
          design_data: designData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        design: data,
        message: 'Design updated successfully'
      });
    } else {
      // Create new design
      const { data, error } = await supabase
        .from('coterm_calculations')
        .insert({
          user_id: userId,
          title: title || 'Untitled Co-Term Calculation',
          design_type: designType,
          design_data: designData,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        design: data,
        message: 'Design saved successfully'
      });
    }

  } catch (error) {
    console.error('Save design API error:', error);
    return NextResponse.json(
      { error: 'Failed to save design' },
      { status: 500 }
    );
  }
}
