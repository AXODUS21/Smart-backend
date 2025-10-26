'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Users, Check, X, Clock, User } from 'lucide-react';

export default function PendingStudents() {
  const { user } = useAuth();
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [success, setSuccess] = useState('');

  // Fetch pending students
  useEffect(() => {
    const fetchPendingStudents = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('Tutors')
          .select('pending_students')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching pending students:', error);
        } else {
          setPendingStudents(data?.pending_students || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingStudents();
  }, [user]);

  // Accept a student
  const handleAcceptStudent = async (studentId, studentName) => {
    setProcessing(prev => ({ ...prev, [studentId]: 'accepting' }));
    setSuccess('');

    try {
      // Use the database function to handle accepting the student
      const { data, error } = await supabase.rpc('accept_student', {
        p_tutor_id: user.id,
        p_student_id: studentId
      });

      if (error) throw error;

      // Update local state
      const updatedPending = pendingStudents.filter(student => student.student_id !== studentId);
      setPendingStudents(updatedPending);
      setSuccess(`Accepted ${studentName} as your student!`);
    } catch (error) {
      console.error('Error accepting student:', error);
      alert('Error accepting student. Please try again.');
    } finally {
      setProcessing(prev => ({ ...prev, [studentId]: null }));
    }
  };

  // Reject a student
  const handleRejectStudent = async (studentId, studentName) => {
    setProcessing(prev => ({ ...prev, [studentId]: 'rejecting' }));
    setSuccess('');

    try {
      // Use the database function to handle rejecting the student
      const { data, error } = await supabase.rpc('reject_student', {
        p_tutor_id: user.id,
        p_student_id: studentId
      });

      if (error) throw error;

      // Update local state
      const updatedPending = pendingStudents.filter(student => student.student_id !== studentId);
      setPendingStudents(updatedPending);
      setSuccess(`Rejected ${studentName}'s request.`);
    } catch (error) {
      console.error('Error rejecting student:', error);
      alert('Error rejecting student. Please try again.');
    } finally {
      setProcessing(prev => ({ ...prev, [studentId]: null }));
    }
  };

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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Pending Student Requests</h3>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Pending Students List */}
      <div className="space-y-4">
        {pendingStudents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No pending student requests.</p>
            <p className="text-sm">Students who request you will appear here.</p>
          </div>
        ) : (
          pendingStudents.map((student, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{student.student_name}</h4>
                    <span className="text-sm text-gray-500">Student</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      Requested: {new Date(student.requested_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptStudent(student.student_id, student.student_name)}
                    disabled={processing[student.student_id]}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    {processing[student.student_id] === 'accepting' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Accept
                  </button>
                  
                  <button
                    onClick={() => handleRejectStudent(student.student_id, student.student_name)}
                    disabled={processing[student.student_id]}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    {processing[student.student_id] === 'rejecting' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
