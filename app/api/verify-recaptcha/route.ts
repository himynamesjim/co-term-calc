import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 400 }
      );
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      // In development/testing without reCAPTCHA configured, allow through
      return NextResponse.json({ success: true, score: 1.0 });
    }

    // Verify the token with Google
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    const verifyResponse = await fetch(verifyURL, {
      method: 'POST',
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'reCAPTCHA verification failed',
          errorCodes: verifyData['error-codes']
        },
        { status: 400 }
      );
    }

    // Return success and score
    return NextResponse.json({
      success: true,
      score: verifyData.score,
      action: verifyData.action,
    });

  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
