'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Users, Clock, BookOpen, Check, X } from 'lucide-react';

export default function MyTutors() {
  const { user } = useAuth();
  const [acceptedTutors, setAcceptedTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestedTutors, setRequestedTutors] = useState([]);

  // Fetch student's tutors
  useEffect(() => {
    const fetchTutors = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('Students')
          .select('requested_tutors')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching tutors:', error);
        } else {
          const requests = data?.requested_tutors || [];
          setRequestedTutors(requests);
          
          // Filter accepted tutors
          const accepted = requests.filter(req => req.status === 'accepted');
          setAcceptedTutors(accepted);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTutors();
  }, [user]);

  // Get tutor details for accepted tutors
  const [tutorDetails, setTutorDetails] = useState([]);
  
  useEffect(() => {
    const fetchTutorDetails = async () => {
      if (acceptedTutors.length === 0) return;
      
      try {
        const tutorIds = acceptedTutors.map(tutor => tutor.tutor_id);
        const { data, error } = await supabase
          .from('Tutors')
          .select('user_id, name, email, subjects, availability')
          .in('user_id', tutorIds);

        if (error) {
          console.error('Error fetching tutor details:', error);
        } else {
          setTutorDetails(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchTutorDetails();
  }, [acceptedTutors]);

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
        <h3 className="text-lg font-semibold text-gray-900">My Tutors</h3>
      </div>

      {/* Accepted Tutors */}
      <div className="mb-8">
        <h4 className="text-md font-semibold text-gray-700 mb-4">
          Accepted Tutors ({acceptedTutors.length})
        </h4>
        
        {acceptedTutors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No accepted tutors yet.</p>
            <p className="text-sm">Tutors you've requested will appear here once they accept.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tutorDetails.map((tutor) => {
              const requestInfo = acceptedTutors.find(req => req.tutor_id === tutor.user_id);
              return (
                <div key={tutor.user_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {tutor.name || 'Tutor'}
                        </h4>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                          Accepted
                        </span>
                      </div>
                      
                      {/* Subjects */}
                      {tutor.subjects && tutor.subjects.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Subjects:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tutor.subjects.map((subjectObj, index) => {
                              const subject = typeof subjectObj === 'string' 
                                ? subjectObj 
                                : subjectObj.subject;
                              const gradeLevel = typeof subjectObj === 'object' 
                                ? subjectObj.grade_level 
                                : null;
                              return (
                                <span
                                  key={index}
                                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                                  title={gradeLevel ? `${subject} - ${gradeLevel}` : subject}
                                >
                                  {subject}
                                  {gradeLevel && (
                                    <span className="text-blue-600 ml-1">({gradeLevel})</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Availability */}
                      {tutor.availability && tutor.availability.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Available Times:</span>
                          </div>
                          <div className="space-y-1">
                            {tutor.availability.slice(0, 3).map((slot, index) => (
                              <div key={index} className="text-sm text-gray-600">
                                {slot.day}: {slot.startTime} - {slot.endTime} UTC
                              </div>
                            ))}
                            {tutor.availability.length > 3 && (
                              <div className="text-sm text-gray-500">
                                +{tutor.availability.length - 3} more time slots
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Accepted Date */}
                      {requestInfo?.accepted_at && (
                        <div className="text-sm text-gray-500">
                          Accepted: {new Date(requestInfo.accepted_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {requestedTutors.some(req => req.status === 'pending') && (
        <div className="border-t pt-6">
          <h4 className="text-md font-semibold text-gray-700 mb-4">
            Pending Requests ({requestedTutors.filter(req => req.status === 'pending').length})
          </h4>
          <div className="space-y-3">
            {requestedTutors
              .filter(req => req.status === 'pending')
              .map((request, index) => (
                <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{request.tutor_name}</span>
                      <span className="text-sm text-gray-500 ml-2">(Pending)</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Requested: {new Date(request.requested_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
