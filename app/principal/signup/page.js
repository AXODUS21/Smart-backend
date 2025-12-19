'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, UserPlus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/authHelpers';

export default function PrincipalSignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [districtSchoolName, setDistrictSchoolName] = useState('');
  const [typeOfSchool, setTypeOfSchool] = useState('');
  const [typeOfStudents, setTypeOfStudents] = useState([]);
  const [otherStudentText, setOtherStudentText] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const schoolOptions = [
    'Private- Parochial School',
    'Private-Independent School',
    'Charter School',
    'Public School',
    'Title 1 School',
    'Non Title 1 School',
    'Virtual School',
    'Other',
  ];

  const studentTypeOptions = [
    'PK–12',
    'PK–5 (Elementary)',
    '6–8 (Middle School)',
    '9–12 (High School)',
    'K–12',
    'PK–8',
    'K–8',
    '6–12',
    'Other (Specify)',
  ];

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!districtSchoolName || !typeOfSchool || typeOfStudents.length === 0) {
      setError('Please complete all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (typeOfStudents.includes('Other (Specify)') && !otherStudentText.trim()) {
      setError('Please specify the student type for "Other (Specify)".');
      return;
    }

    setLoading(true);
    try {
      const studentsToSave = typeOfStudents.map((val) =>
        val === 'Other (Specify)' ? `Other: ${otherStudentText.trim()}` : val
      );

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName,
            user_type: 'principal',
            contact_number: contactNumber,
            address,
            district_school_name: districtSchoolName,
            type_of_school: typeOfSchool,
            type_of_students: studentsToSave,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        try {
          await ensureUserProfile(
            authData.user.id,
            firstName,
            lastName,
            email,
            'principal',
            {
              middle_name: middleName,
              contact_number: contactNumber,
              address,
              district_school_name: districtSchoolName,
              type_of_school: typeOfSchool,
              type_of_students: studentsToSave,
            }
          );
        } catch (profileError) {
          console.error('Profile creation failed:', profileError);
        }

        try {
          const { notifySignup } = await import('@/lib/notificationService');
          await notifySignup(email, 'principal', firstName, lastName);
        } catch (notifError) {
          console.error('Failed to send signup notification:', notifError);
        }

        setSuccess(`A confirmation email has been sent to ${email}. Please verify to finish setting up your principal account.`);
        setFirstName('');
        setLastName('');
        setMiddleName('');
        setEmail('');
        setContactNumber('');
        setAddress('');
        setDistrictSchoolName('');
        setTypeOfSchool('');
        setTypeOfStudents([]);
        setOtherStudentText('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <button
            onClick={() => router.push('/login')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to login"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Principal Sign Up</h1>
            <p className="text-sm text-gray-600">Create your principal account</p>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border-2 border-green-200 p-4 text-sm text-green-800 flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-1">
                <label htmlFor="last-name" className="text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2 col-span-1">
                <label htmlFor="first-name" className="text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2 col-span-1">
                <label htmlFor="middle-name" className="text-sm font-medium text-gray-700">
                  Middle Name
                </label>
                <input
                  id="middle-name"
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Middle name"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="contact-number" className="text-sm font-medium text-gray-700">
                  Contact Number
                </label>
                <input
                  id="contact-number"
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="Contact number"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your address"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="district-school" className="text-sm font-medium text-gray-700">
                District / School Name
              </label>
              <select
                id="district-school"
                value={districtSchoolName}
                onChange={(e) => setDistrictSchoolName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="" disabled>
                  Select your district / school
                </option>
                {schoolOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="type-of-school" className="text-sm font-medium text-gray-700">
                Type of School
              </label>
              <select
                id="type-of-school"
                value={typeOfSchool}
                onChange={(e) => setTypeOfSchool(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="" disabled>
                  Select school type
                </option>
                {schoolOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Type of Students</label>
              <div className="grid grid-cols-2 gap-2">
                {studentTypeOptions.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      value={opt}
                      checked={typeOfStudents.includes(opt)}
                      onChange={(e) => {
                        const { checked, value } = e.target;
                        setTypeOfStudents((prev) =>
                          checked ? [...prev, value] : prev.filter((item) => item !== value)
                        );
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
              {typeOfStudents.includes('Other (Specify)') && (
                <div className="space-y-1">
                  <label htmlFor="other-student" className="text-xs font-medium text-gray-600">
                    Please specify
                  </label>
                  <input
                    id="other-student"
                    type="text"
                    value={otherStudentText}
                    onChange={(e) => setOtherStudentText(e.target.value)}
                    placeholder="Describe the student type"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
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
              <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
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
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  Create Principal Account
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}









