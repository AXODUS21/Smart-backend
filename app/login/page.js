'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, UserPlus, GraduationCap, BookOpen, X, Mail, Key } from 'lucide-react';
import emailjs from '@emailjs/browser';

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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userType, setUserType] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [verificationSent, setVerificationSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
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

  // Handle countdown timer
  useEffect(() => {
    let timer;
    if (resetStep === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && resetStep === 2) {
      setError('Verification code has expired. Please request a new one.');
      setResetStep(1);
    }
    return () => clearInterval(timer);
  }, [countdown, resetStep]);

  // Countdown timer for verification code
  useEffect(() => {
    let interval;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendVerificationEmail = async (email, code) => {
    try {
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      const templateParams = {
        to_email: email,
        verification_code: code,
      };

      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store in localStorage with expiration (5 minutes)
      const expiryTime = Date.now() + 300000; // 5 minutes from now
      localStorage.setItem('resetCode', code);
      localStorage.setItem('resetEmail', resetEmail);
      localStorage.setItem('codeExpiry', expiryTime.toString());

      // Send email using Email.js
      const templateParams = {
        to_email: resetEmail,
        verification_code: code,
      };

      const response = await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
        templateParams,
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
      );

      if (response.status === 200) {
        setResetStep(2); // Move to verification code input
        setCountdown(300); // 5 minutes countdown
        setSuccess('Verification code sent to your email!');
      } else {
        throw new Error('Failed to send email');
      }
    } catch (err) {
      console.error('Error sending verification code:', err);
      setError('Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = () => {
    const storedCode = localStorage.getItem('resetCode');
    const storedEmail = localStorage.getItem('resetEmail');
    const expiry = parseInt(localStorage.getItem('codeExpiry') || '0');
    
    if (Date.now() > expiry) {
      setError('Verification code has expired. Please request a new one.');
      setResetStep(1);
      return false;
    }
    
    if (verificationCode === storedCode && resetEmail === storedEmail) {
      setResetStep(3);
      setError('');
      setSuccess('Code verified! Please set your new password.');
      return true;
    } else {
      setError('Invalid verification code. Please try again.');
      return false;
    }
  };

  const resendVerificationCode = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiryTime = Date.now() + 300000; // 5 minutes from now
      
      localStorage.setItem('resetCode', code);
      localStorage.setItem('codeExpiry', expiryTime.toString());

      const templateParams = {
        to_email: resetEmail,
        verification_code: code,
      };

      const response = await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
        templateParams,
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
      );

      if (response.status === 200) {
        setCountdown(300); // Reset countdown to 5 minutes
        setSuccess('New verification code sent to your email!');
      } else {
        throw new Error('Failed to resend code');
      }
    } catch (err) {
      console.error('Error resending verification code:', err);
      setError('Failed to resend verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const email = localStorage.getItem('resetEmail');
      if (!email) {
        throw new Error('Session expired. Please try again.');
      }

      // Call our API route to update the password
      const response = await fetch('/api/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      // Clear the stored code and email
      localStorage.removeItem('resetCode');
      localStorage.removeItem('resetEmail');
      localStorage.removeItem('codeExpiry');

      setSuccess('Password updated successfully! You can now sign in with your new password.');
      
      // Reset form and close modal after a delay
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetStep(1);
        setResetEmail('');
        setVerificationCode('');
        setNewPassword('');
        setSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to create user profile if it doesn't exist
  const ensureUserProfile = async (userId, userFirstName, userLastName, userEmail, userType) => {
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
              first_name: userFirstName || '',
              last_name: userLastName || '',
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
              first_name: userFirstName || '',
              last_name: userLastName || '',
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
        // Validate passwords match
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        
        // Sign up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              user_type: userType,
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          // Try to create profile manually as fallback (in case trigger didn't run)
          try {
            await ensureUserProfile(authData.user.id, firstName, lastName, email, userType);
          } catch (profileError) {
            // If profile creation fails, still show success but log the error
            console.error('Profile creation failed:', profileError);
            // Don't throw here - user account was created, profile can be created later
          }

          setSuccess(`A confirmation email has been sent to ${email}. Please check your inbox (and spam folder) and click the confirmation link to verify your account.`);
          
          // Clear form
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setFirstName('');
          setLastName('');
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
                setPassword('');
                setConfirmPassword('');
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
                setPassword('');
                setConfirmPassword('');
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
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="signup-firstname" className="text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    id="signup-firstname"
                    name="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="signup-lastname" className="text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    id="signup-lastname"
                    name="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
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
              <div className="space-y-2">
                <label htmlFor="signup-confirm-password" className="text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-0 h-full px-3 py-2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
                )}
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

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetStep(1);
                setError('');
                setSuccess('');
                setResetEmail('');
                setVerificationCode('');
                setNewPassword('');
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {resetStep === 1 && 'Reset Your Password'}
                {resetStep === 2 && 'Verify Your Email'}
                {resetStep === 3 && 'Create New Password'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-md text-sm">
                  {success}
                </div>
              )}

              {resetStep === 1 && (
                <div className="space-y-4">
                  <p className="text-gray-600 mb-4">
                    Enter your email address and we'll send you a verification code to reset your password.
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
                    {loading ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </div>
              )}

              {resetStep === 2 && (
                <div className="space-y-4">
                  <p className="text-gray-600 mb-4">
                    We've sent a 6-digit verification code to <span className="font-semibold">{resetEmail}</span>.
                    Please enter it below to continue.
                  </p>
                  <div className="space-y-2">
                    <label htmlFor="verification-code" className="text-sm font-medium text-gray-700">
                      Verification Code
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="verification-code"
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="w-full pl-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <button
                        type="button"
                        onClick={resendVerificationCode}
                        disabled={countdown > 0 || loading}
                        className={`text-xs ${countdown > 0 ? 'text-gray-400' : 'text-blue-600 hover:underline'}`}
                      >
                        {countdown > 0 ? `Resend code in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}` : 'Resend code'}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={() => setResetStep(1)}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => verifyCode()}
                      disabled={verificationCode.length !== 6 || loading}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Verifying...' : 'Verify Code'}
                    </button>
                  </div>
                </div>
              )}

              {resetStep === 3 && (
                <div className="space-y-4">
                  <p className="text-gray-600 mb-4">
                    Please enter your new password. Make sure it's at least 6 characters long.
                  </p>
                  <div className="space-y-2">
                    <label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full pl-10 pr-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
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
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={() => setResetStep(2)}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={resetPassword}
                      disabled={!newPassword || newPassword.length < 6 || loading}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
