'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Video, Calendar, Clock, BookOpen, Plus } from 'lucide-react';
import MeetingScheduler from './MeetingScheduler';

export default function Meetings() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Determine user role
  useEffect(() => {
    const determineRole = async () => {
      if (!user) return;
      
      try {
        // Check if user is a student
        const { data: studentData } = await supabase
          .from('Students')
          .select('user_id')
          .eq('user_id', user.id)
          .single();

        if (studentData) {
          setUserRole('student');
        } else {
          setUserRole('tutor');
        }
      } catch (error) {
        console.error('Error determining role:', error);
      } finally {
        setLoading(false);
      }
    };

    determineRole();
  }, [user]);

  // Fetch scheduled meetings for students
  useEffect(() => {
    const fetchMeetings = async () => {
      if (!user || userRole !== 'student') return;
      
      try {
        const { data, error } = await supabase
          .from('Schedules')
          .select(`
            *,
            tutor:user_id (
              name,
              email
            )
          `)
          .eq('student_id', user.id)
          .order('start_time_utc', { ascending: true });

        if (error) {
          console.error('Error fetching meetings:', error);
        } else {
          setScheduledMeetings(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchMeetings();
  }, [user, userRole]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  // Student view
  if (userRole === 'student') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">My Meetings</h3>
          </div>
          <button
            onClick={() => setShowScheduler(!showScheduler)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Schedule Meeting
          </button>
        </div>

        {/* Meeting Scheduler */}
        {showScheduler && (
          <div className="mb-6">
            <MeetingScheduler />
          </div>
        )}

        {/* Scheduled Meetings */}
        <div>
          <h4 className="text-md font-semibold text-gray-700 mb-4">
            Upcoming Meetings ({scheduledMeetings.length})
          </h4>
          
          {scheduledMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No meetings scheduled yet.</p>
              <p className="text-sm">Click "Schedule Meeting" to book a session with your tutors.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledMeetings.map((meeting) => (
                <div key={meeting.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {meeting.subject}
                        </h4>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                          {meeting.status}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        with {meeting.tutor?.name || 'Tutor'}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(meeting.start_time_utc).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(meeting.start_time_utc).toLocaleTimeString()} - {new Date(meeting.end_time_utc).toLocaleTimeString()} UTC
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {meeting.duration_min} minutes ({meeting.credits_required} credits)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tutor view (placeholder for now)
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Video className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">My Meetings</h3>
      </div>
      <p className="text-gray-600">View and manage your upcoming meetings with students.</p>
    </div>
  );
}
