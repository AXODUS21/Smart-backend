'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, BookOpen, X, Check } from 'lucide-react';

export default function BookingModal({ tutor, isOpen, onClose }) {
  const { user } = useAuth();
  const [booking, setBooking] = useState({});
  const [success, setSuccess] = useState('');

  // Request a meeting for a specific time slot
  const handleRequestMeeting = async (availability, day) => {
    setBooking(prev => ({ ...prev, [`${day}-${availability.startTime}`]: true }));
    setSuccess('');

    try {
      // Calculate start and end times
      const startTime = new Date(`${new Date().toISOString().split('T')[0]}T${availability.startTime}:00Z`);
      const endTime = new Date(`${new Date().toISOString().split('T')[0]}T${availability.endTime}:00Z`);
      
      // Calculate duration in minutes
      const duration = (endTime - startTime) / (1000 * 60);
      
      // Calculate credits (1 credit = 30 minutes)
      const creditsRequired = Math.ceil(duration / 30);

      // Get student and tutor IDs (bigint) from their respective tables
      const { data: studentData, error: studentError } = await supabase
        .from('Students')
        .select('id, credits')
        .eq('user_id', user.id)
        .single();

      if (studentError) throw studentError;

      const { data: tutorData, error: tutorError } = await supabase
        .from('Tutors')
        .select('id')
        .eq('user_id', tutor.user_id)
        .single();

      if (tutorError) throw tutorError;

      // Check if student has enough credits
      if (studentData.credits < creditsRequired) {
        alert(`Insufficient credits. You need ${creditsRequired} credits but only have ${studentData.credits}.`);
        return;
      }

      // Create booking request in Schedules table
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('Schedules')
        .insert({
          student_id: studentData.id,
          tutor_id: tutorData.id,
          subject: 'General Session', // Default subject since students can't specify
          start_time_utc: startTime.toISOString(),
          end_time_utc: endTime.toISOString(),
          duration_min: duration,
          credits_required: creditsRequired,
          status: 'pending'
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // Deduct credits
      const newCredits = studentData.credits - creditsRequired;
      const { error: updateCreditsError } = await supabase
        .from('Students')
        .update({ credits: newCredits })
        .eq('id', studentData.id);

      if (updateCreditsError) throw updateCreditsError;

      setSuccess(`Meeting request sent! ${creditsRequired} credits deducted.`);
      
      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error requesting meeting:', error);
      alert('Error requesting meeting. Please try again.');
    } finally {
      setBooking(prev => ({ ...prev, [`${day}-${availability.startTime}`]: false }));
    }
  };

  if (!isOpen || !tutor) return null;

  // Group availability by day
  const availabilityByDay = {};
  (tutor.availability || []).forEach(slot => {
    if (!availabilityByDay[slot.day]) {
      availabilityByDay[slot.day] = [];
    }
    availabilityByDay[slot.day].push(slot);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">
              Request Meeting with {tutor.name || tutor.email}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success Message */}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
              <Check className="h-4 w-4" />
              {success}
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> You can request meetings during the tutor's available time slots. 
              The tutor will review and approve/reject your request. Credits will be deducted when you make the request.
            </p>
          </div>

          {/* Availability by Day */}
          <div className="space-y-6">
            {Object.keys(availabilityByDay).map((day) => (
              <div key={day} className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {day}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availabilityByDay[day].map((slot, index) => {
                    const duration = (new Date(`2000-01-01T${slot.endTime}:00Z`) - new Date(`2000-01-01T${slot.startTime}:00Z`)) / (1000 * 60);
                    const creditsRequired = Math.ceil(duration / 30);
                    const bookingKey = `${day}-${slot.startTime}`;
                    
                    return (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="text-sm text-gray-600 mb-2">
                          <div className="font-medium">{slot.startTime} - {slot.endTime} UTC</div>
                          <div className="text-xs text-gray-500">{duration} minutes ({creditsRequired} credits)</div>
                        </div>
                        <button
                          onClick={() => handleRequestMeeting(slot, day)}
                          disabled={booking[bookingKey]}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                          {booking[bookingKey] ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <BookOpen className="h-3 w-3" />
                              Request Meeting
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {Object.keys(availabilityByDay).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No availability set by this tutor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
