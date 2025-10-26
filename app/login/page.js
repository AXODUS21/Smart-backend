'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userType, setUserType] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  // Auto-dismiss success message after 10 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isSignUp) {
        // Sign up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              user_type: userType
            }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // Wait a moment for the session to be established
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get the current session
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          
          if (currentSession) {
            // Now insert into appropriate table based on user type
            if (userType === 'student') {
              const { error: studentError } = await supabase
                .from('Students')
                .insert({
                  user_id: authData.user.id,
                  email: email,
                  name: name,
                  credits: 0,
                  tutors: [],
                  tutoring_sched: []
                });

              if (studentError) throw studentError;
            } else {
              const { error: tutorError } = await supabase
                .from('Tutors')
                .insert({
                  user_id: authData.user.id,
                  email: email,
                  name: name,
                  subjects: [],
                  availability: [],
                  students_id: []
                });

              if (tutorError) throw tutorError;
            }
            
            setSuccess(`Account created successfully! A confirmation email has been sent to ${email}. Please check your inbox and click the link to verify your account.`);
            setIsSignUp(false);
            setEmail('');
            setPassword('');
            setName('');
          }
        }
      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-100 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-100 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400">
            <div className="font-semibold mb-1">✓ Success!</div>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label htmlFor="userType" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  I want to sign up as
                </label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="userType"
                      value="student"
                      checked={userType === 'student'}
                      onChange={(e) => setUserType(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Student</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="userType"
                      value="tutor"
                      checked={userType === 'tutor'}
                      onChange={(e) => setUserType(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Tutor</span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => setIsSignUp(false)}
                className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => setIsSignUp(true)}
                className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

