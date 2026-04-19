'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, X, Mail, Key, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/authHelpers';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const router = useRouter();

  // Auto-dismiss success message after 10 seconds and handle countdown
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [success]);



  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        throw error;
      }

      setSuccess('A password reset link has been sent to your email address!');
      
      // Close the modal after a few seconds
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail('');
        setSuccess('');
      }, 5000);
      
    } catch (err) {
      console.error('Error sending reset link:', err);
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (signInData.user) {
        // Check if profile exists, create if missing
        const userType = signInData.user.user_metadata?.user_type;
        const userFirstName = signInData.user.user_metadata?.first_name || '';
        const userLastName = signInData.user.user_metadata?.last_name || '';
        
        if (userType) {
          try {
            await ensureUserProfile(signInData.user.id, userFirstName, userLastName, signInData.user.email, userType);
          } catch (profileError) {
            // Log but don't block login
            console.error('Profile check/creation failed:', profileError);
          }
        }
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="p-8 space-y-1">
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Welcome
          </h1>
          <p className="text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        <div className="px-8 pb-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border-2 border-green-200 p-5 text-sm">
              <div className="font-bold text-green-800 mb-2 text-base flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Account Created Successfully!
              </div>
              <div className="text-green-700 leading-relaxed">{success}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="signin-email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="signin-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signin-password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="signin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-3 py-2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center mt-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                'Signing in...'
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2">
            <p className="text-center text-sm text-gray-600">Need an account?</p>
            <div className="flex flex-col gap-2">
              <Link
                href="/student/signup"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
              >
                Sign up as Student
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/tutor/signup"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
              >
                Sign up as Tutor
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/principal/signup"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
              >
                Sign up as Principal
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setError('');
                setSuccess('');
                setResetEmail('');
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="space-y-4">
                <p className="text-gray-600 mb-4">
                  Enter your email address and we'll send you a password reset link.
                </p>
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full pl-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
