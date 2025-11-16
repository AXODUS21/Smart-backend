'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Key, CheckCircle } from 'lucide-react';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we're in a password recovery flow
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User is in password recovery mode
        // The session contains the user's email
        // We don't need to do anything special here as the session is already set
      } else if (event === 'SIGNED_OUT') {
        // User was signed out, redirect to login
        router.push('/login');
      }
    });

    // Check for the access token in the URL
    const accessToken = searchParams.get('access_token');
    const type = searchParams.get('type');
    
    // If there's no access token or it's not a recovery flow, redirect to login
    if (!accessToken || type !== 'recovery') {
      router.push('/login');
    }
  }, [searchParams, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First, get the current session to ensure we're authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Your session has expired. Please request a new password reset link.');
      }

      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      // Sign out the user after password update
      await supabase.auth.signOut();

      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      console.error('Error updating password:', err);
      setError(err.message || 'An error occurred while updating your password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Updated!</h1>
          <p className="text-gray-600 mb-6">
            Your password has been successfully updated. You'll be redirected to the login page shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Set a New Password</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full pl-10 pr-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
                minLength={6}
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

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full pl-10 pr-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
                minLength={6}
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
            className="w-full mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
