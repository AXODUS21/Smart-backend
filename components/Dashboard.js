'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Wallet, 
  Calendar as CalendarIcon, 
  Users, 
  Search, 
  GraduationCap, 
  BookOpen,
  Menu,
  X,
  LogOut,
  Video
} from 'lucide-react';

// Dashboard components
import Credits from './dashboard/Credits';
import Meetings from './dashboard/Meetings';
import MyTutors from './dashboard/MyTutors';
import FindTutors from './dashboard/FindTutors';
import Calendar from './dashboard/Calendar';
import MyStudents from './dashboard/MyStudents';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function determineRole() {
      if (!user) return;

      try {
        // Check if user is in Students table
        const { data: studentData } = await supabase
          .from('Students')
          .select('id, name, email, credits')
          .eq('user_id', user.id)
          .single();

        if (studentData) {
          setUserRole('student');
        } else {
          // Check if user is in Tutors table
          const { data: tutorData } = await supabase
            .from('Tutors')
            .select('id, name, email, subjects')
            .eq('user_id', user.id)
            .single();

          if (tutorData) {
            setUserRole('tutor');
          }
        }
      } catch (error) {
        console.error('Error determining role:', error);
      } finally {
        setLoading(false);
      }
    }

    determineRole();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const studentTabs = [
    { id: 'credits', label: 'Credits', icon: Wallet },
    { id: 'meetings', label: 'Meetings', icon: Video }, 
    { id: 'tutors', label: 'My Tutors', icon: Users },
    { id: 'find-tutors', label: 'Find Tutors', icon: Search },
  ];

  const tutorTabs = [
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'meetings', label: 'Meetings', icon: Video },
    { id: 'students', label: 'My Students', icon: Users },
  ];

  const tabs = userRole === 'student' ? studentTabs : tutorTabs;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {userRole === 'student' ? (
              <GraduationCap className="w-8 h-8 text-blue-600" />
            ) : (
              <BookOpen className="w-8 h-8 text-green-600" />
            )}
            {sidebarOpen && (
              <span className="font-bold text-gray-900">
                {userRole === 'student' ? 'Student' : 'Tutor'}
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3 px-4 py-2 text-sm text-gray-600">
            {sidebarOpen && <div className="truncate">{user?.email}</div>}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
          </h2>
        </header>

        <main className="flex-1 p-6">
          {activeTab === 'home' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Welcome back, {user?.email}!
              </h3>
              <p className="text-gray-600">
                Select an option from the sidebar to get started.
              </p>
            </div>
          )}

          {activeTab === 'credits' && userRole === 'student' && <Credits />}
          {activeTab === 'meetings' && userRole === 'student' && <Meetings />}
          {activeTab === 'tutors' && userRole === 'student' && <MyTutors />}
          {activeTab === 'find-tutors' && userRole === 'student' && <FindTutors />}
          {activeTab === 'calendar' && userRole === 'tutor' && <Calendar />}
          {activeTab === 'meetings' && userRole === 'tutor' && <Meetings />}
          {activeTab === 'students' && userRole === 'tutor' && <MyStudents />}
        </main>
      </div>
    </div>
  );
}

