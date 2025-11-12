'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Sign in
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (authData.user) {
        // Verify that this user is actually a superadmin
        const { data: superadminData, error: superadminError } = await supabase
          .from('superadmins')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (superadminError) {
          console.error('Superadmin verification error:', superadminError);
          // Sign out if there's an error
          await supabase.auth.signOut();
          setError('Error verifying superadmin access. Please try again.');
          setLoading(false);
          return;
        }

        if (!superadminData) {
          // Sign out if not a superadmin
          await supabase.auth.signOut();
          setError('Access denied. Superadmin credentials required.');
          setLoading(false);
          return;
        }

        // Redirect to dashboard
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-red-200">
        <div className="p-8 space-y-1">
          <div className="flex items-center justify-center mb-4">
            <ShieldCheck className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Super Admin Login
          </h1>
          <p className="text-center text-sm text-gray-600">
            Super administrative access only
          </p>
        </div>

        <div className="px-8 pb-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="superadmin-email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="superadmin-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter superadmin email"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="superadmin-password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="superadmin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter superadmin password"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                'Signing in...'
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In as Super Admin
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              For admin login, please use the{' '}
              <a href="/admin/login" className="text-red-600 hover:text-red-700 underline">
                admin login page
              </a>
              {' '}or{' '}
              <a href="/login" className="text-red-600 hover:text-red-700 underline">
                regular login page
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}








