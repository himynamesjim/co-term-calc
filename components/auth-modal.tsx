'use client';

import { useState } from 'react';
import { X, Shield } from 'lucide-react';
import { signIn, signUp } from '@/lib/supabase';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const recaptcha = useGoogleReCaptcha();
  const executeRecaptcha = recaptcha?.executeRecaptcha;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Execute reCAPTCHA only for sign-up and if available
      if (isSignUp && executeRecaptcha) {
        try {
          const token = await executeRecaptcha('signup');

          // Verify the token on the server
          const verifyResponse = await fetch('/api/verify-recaptcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });

          const verifyResult = await verifyResponse.json();

          if (!verifyResult.success) {
            throw new Error('reCAPTCHA verification failed. Please try again.');
          }

          // Score should be above 0.5 (0.0 = bot, 1.0 = human)
          if (verifyResult.score < 0.5) {
            throw new Error('Security check failed. Please contact support if you believe this is an error.');
          }
        } catch (recaptchaError) {
          console.warn('reCAPTCHA error (continuing anyway):', recaptchaError);
          // Continue with sign-up even if reCAPTCHA fails
        }
      }

      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;
        alert('Check your email for the confirmation link!');
        onClose();
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0a0d14] rounded-lg p-8 max-w-md w-full mx-4 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
              {error}
            </div>
          )}

          {isSignUp && executeRecaptcha && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <Shield size={16} className="text-green-500" />
              <span>Protected by reCAPTCHA</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="w-full text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
