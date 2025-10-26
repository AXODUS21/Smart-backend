'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Users, Mail, X, Trash2, Check } from 'lucide-react';

export default function MyStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState({});
  const [success, setSuccess] = useState('');

  // Fetch accepted students
  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('Tutors')
          .select('students_id')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching students:', error);
        } else {
          setStudents(data?.students_id || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [user]);

  // Get student details for accepted students
  const [studentDetails, setStudentDetails] = useState([]);
  
  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (students.length === 0 || !user) {
        setStudentDetails([]);
        return;
      }
      
      try {
        const { data, error } = await supabase.rpc('get_tutor_students', {
          p_tutor_id: user.id
        });

        if (error) {
          console.error('Error fetching student details:', error);
        } else {
          setStudentDetails(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchStudentDetails();
  }, [students, user]);

  // Remove a student
  const handleRemoveStudent = async (studentId, studentName) => {
    setRemoving(prev => ({ ...prev, [studentId]: true }));
    setSuccess('');

    try {
      // Use the database function to handle removing the student
      const { data, error } = await supabase.rpc('remove_student', {
        p_tutor_id: user.id,
        p_student_id: studentId
      });

      if (error) throw error;

      // Update local state
      const updatedStudents = students.filter(student => student.student_id !== studentId);
      setStudents(updatedStudents);
      setSuccess(`Removed ${studentName} from your students.`);
    } catch (error) {
      console.error('Error removing student:', error);
      alert('Error removing student. Please try again.');
    } finally {
      setRemoving(prev => ({ ...prev, [studentId]: false }));
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
        <h3 className="text-lg font-semibold text-gray-900">My Students</h3>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Students List */}
      <div className="space-y-4">
        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No accepted students yet.</p>
            <p className="text-sm">Students you accept will appear here.</p>
          </div>
        ) : (
          studentDetails.map((studentDetail) => {
            const studentInfo = students.find(s => s.student_id === studentDetail.user_id);
            return (
              <div key={studentDetail.user_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {studentDetail.name || 'Student'}
                      </h4>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                        Accepted
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Mail className="h-4 w-4" />
                      {studentDetail.email}
                    </div>

                    {/* Accepted Date */}
                    {studentInfo?.accepted_at && (
                      <div className="text-sm text-gray-500">
                        Accepted: {new Date(studentInfo.accepted_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemoveStudent(studentDetail.user_id, studentDetail.name || studentDetail.email)}
                    disabled={removing[studentDetail.user_id]}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50 p-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                    title="Remove student"
                  >
                    {removing[studentDetail.user_id] ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
