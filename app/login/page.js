'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, UserPlus, GraduationCap, BookOpen } from 'lucide-react';

const USER_ROLES = [
  {
    value: 'student',
    label: 'Student - Looking for tutoring',
    icon: GraduationCap,
  },
  {
    value: 'tutor',
    label: 'Tutor - Want to teach students',
    icon: BookOpen,
  },
];

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userType, setUserType] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
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

  // Helper function to create user profile if it doesn't exist
  const ensureUserProfile = async (userId, userName, userEmail, userType) => {
    try {
      if (userType === 'student') {
        // Check if student profile exists
        const { data: existingStudent } = await supabase
          .from('Students')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingStudent) {
          // Create student profile
          const { error: insertError } = await supabase
            .from('Students')
            .insert({
              user_id: userId,
              name: userName || userEmail,
              email: userEmail,
              credits: 0,
            });

          if (insertError) {
            console.error('Error creating student profile:', insertError);
            throw new Error('Database error saving new user');
          }
        }
      } else if (userType === 'tutor') {
        // Check if tutor profile exists
        const { data: existingTutor } = await supabase
          .from('Tutors')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingTutor) {
          // Create tutor profile
          const { error: insertError } = await supabase
            .from('Tutors')
            .insert({
              user_id: userId,
              name: userName || userEmail,
              email: userEmail,
              subjects: [],
              application_status: false,
            });

          if (insertError) {
            console.error('Error creating tutor profile:', insertError);
            throw new Error('Database error saving new user');
          }
        }
      }
    } catch (err) {
      console.error('Error ensuring user profile:', err);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (activeTab === 'signup') {
        // Sign up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              user_type: userType,
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          // Try to create profile manually as fallback (in case trigger didn't run)
          try {
            await ensureUserProfile(authData.user.id, name, email, userType);
          } catch (profileError) {
            // If profile creation fails, still show success but log the error
            console.error('Profile creation failed:', profileError);
            // Don't throw here - user account was created, profile can be created later
          }

          setSuccess(`A confirmation email has been sent to ${email}. Please check your inbox (and spam folder) and click the confirmation link to verify your account.`);
          
          // Clear form
          setEmail('');
          setPassword('');
          setName('');
          setUserType('student');
          setActiveTab('signin');
        }
      } else {
        // Sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (signInData.user) {
          // Check if profile exists, create if missing
          const userType = signInData.user.user_metadata?.user_type;
          const userName = signInData.user.user_metadata?.name || signInData.user.email;
          
          if (userType) {
            try {
              await ensureUserProfile(signInData.user.id, userName, signInData.user.email, userType);
            } catch (profileError) {
              // Log but don't block login
              console.error('Profile check/creation failed:', profileError);
            }
          }
        }

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="p-8 space-y-1">
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Welcome
          </h1>
          <p className="text-center text-sm text-gray-600">
            Sign in to your account or create a new one
          </p>
        </div>

        <div className="px-8 pb-8">
          {/* Tabs */}
          <div className="grid w-full grid-cols-2 mb-6 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setError('');
                setSuccess('');
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'signin'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError('');
                setSuccess('');
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
          </div>

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

          {/* Sign In Form */}
          {activeTab === 'signin' && (
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
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="signup-name" className="text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  name="fullName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="signup-email"
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
                <label htmlFor="signup-role" className="text-sm font-medium text-gray-700">
                  I am a...
                </label>
                <div className="relative">
                  <select
                    id="signup-role"
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer"
                  >
                    {USER_ROLES.map((role) => {
                      const Icon = role.icon;
                      return (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    minLength={6}
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
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Creating account...'
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
