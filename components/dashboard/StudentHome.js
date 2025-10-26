'use client';

import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, BookOpen, Users, Search } from 'lucide-react';

export default function StudentHome() {
  const { user } = useAuth();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <GraduationCap className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Welcome back, {user?.email}!</h3>
      </div>

      <p className="text-gray-600 mb-6">
        Select an option from the sidebar to get started with your tutoring journey.
      </p>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">My Credits</h4>
          </div>
          <p className="text-sm text-gray-600">Manage your tutoring credits and purchase more.</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-gray-900">Find Tutors</h4>
          </div>
          <p className="text-sm text-gray-600">Browse and connect with qualified tutors.</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Search className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-gray-900">My Tutors</h4>
          </div>
          <p className="text-sm text-gray-600">View your assigned tutors and manage relationships.</p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-5 w-5 text-orange-600" />
            <h4 className="font-semibold text-gray-900">Meetings</h4>
          </div>
          <p className="text-sm text-gray-600">Schedule and manage your tutoring sessions.</p>
        </div>
      </div>
    </div>
  );
}
