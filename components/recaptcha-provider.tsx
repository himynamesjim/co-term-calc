'use client';

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { ReactNode } from 'react';

export function ReCaptchaProvider({ children }: { children: ReactNode }) {
  const reCaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // If no key is configured, render children without reCAPTCHA
  if (!reCaptchaKey || reCaptchaKey === '') {
    console.warn('reCAPTCHA site key not configured - reCAPTCHA will be disabled');
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={reCaptchaKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'body',
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
