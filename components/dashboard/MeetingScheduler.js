'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, BookOpen, Check, User } from 'lucide-react';

export default function MeetingScheduler() {
  const { user } = useAuth();
  const [acceptedTutors, setAcceptedTutors] = useState([]);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [tutorAvailability, setTutorAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    date: '',
    startTime: '',
    duration: 30, // in minutes
    notes: ''
  });

  // Fetch all tutors with availability
  useEffect(() => {
    const fetchTutors = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('Tutors')
          .select('user_id, name, email, subjects, availability')
          .not('user_id', 'eq', user.id); // Exclude current user

        if (error) {
          console.error('Error fetching tutors:', error);
        } else {
          // Filter to only show tutors with availability
          const tutorsWithAvailability = (data || []).filter(tutor => 
            tutor.availability && Array.isArray(tutor.availability) && tutor.availability.length > 0
          );
          
          // Format as accepted tutors for compatibility
          const formattedTutors = tutorsWithAvailability.map(tutor => ({
            tutor_id: tutor.user_id,
            tutor_name: tutor.name || tutor.email
          }));
          
          setAcceptedTutors(formattedTutors);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTutors();
  }, [user]);

  // Fetch tutor availability when tutor is selected
  useEffect(() => {
    const fetchTutorAvailability = async () => {
      if (!selectedTutor) return;
      
      try {
        const { data, error } = await supabase
          .from('Tutors')
          .select('availability, subjects')
          .eq('user_id', selectedTutor.tutor_id)
          .single();

        if (error) {
          console.error('Error fetching tutor availability:', error);
        } else {
          setTutorAvailability(data?.availability || []);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchTutorAvailability();
  }, [selectedTutor]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate credits required
  const creditsRequired = Math.ceil(formData.duration / 30);

  // Schedule meeting
  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    if (!selectedTutor || !formData.subject || !formData.date || !formData.startTime) return;

    setSaving(true);
    setSuccess('');

    try {
      // Calculate end time
      const startTime = new Date(`${formData.date}T${formData.startTime}:00Z`);
      const endTime = new Date(startTime.getTime() + formData.duration * 60000);

      // Check if student has enough credits
      const { data: studentData, error: studentError } = await supabase
        .from('Students')
        .select('credits')
        .eq('user_id', user.id)
        .single();

      if (studentError) throw studentError;

      if (studentData.credits < creditsRequired) {
        alert(`Insufficient credits. You need ${creditsRequired} credits but only have ${studentData.credits}.`);
        return;
      }

      // Create meeting in Schedules table
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('Schedules')
        .insert({
          student_id: user.id,
          tutor_id: selectedTutor.tutor_id,
          subject: formData.subject,
          start_time_utc: startTime.toISOString(),
          end_time_utc: endTime.toISOString(),
          duration_min: formData.duration,
          credits_required: creditsRequired,
          status: 'pending'
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // Deduct credits from student
      const newCredits = studentData.credits - creditsRequired;
      const { error: updateCreditsError } = await supabase
        .from('Students')
        .update({ credits: newCredits })
        .eq('user_id', user.id);

      if (updateCreditsError) throw updateCreditsError;

      setSuccess(`Meeting scheduled successfully! ${creditsRequired} credits deducted.`);
      
      // Reset form
      setFormData({
        subject: '',
        date: '',
        startTime: '',
        duration: 30,
        notes: ''
      });
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      alert('Error scheduling meeting. Please try again.');
    } finally {
      setSaving(false);
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

  if (acceptedTutors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Schedule Meeting</h3>
        </div>
        
        <div className="text-center py-8 text-gray-500">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No tutors with available times found.</p>
          <p className="text-sm">Tutors need to set their availability to schedule meetings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Schedule Meeting</h3>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      <form onSubmit={handleScheduleMeeting} className="space-y-6">
        {/* Tutor Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Tutor
          </label>
          <select
            value={selectedTutor?.tutor_id || ''}
            onChange={(e) => {
              const tutor = acceptedTutors.find(t => t.tutor_id === e.target.value);
              setSelectedTutor(tutor);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Choose a tutor</option>
            {acceptedTutors.map((tutor) => (
              <option key={tutor.tutor_id} value={tutor.tutor_id}>
                {tutor.tutor_name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subject
          </label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            placeholder="e.g., Mathematics, Physics"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time (UTC)
            </label>
            <input
              type="time"
              name="startTime"
              value={formData.startTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration (minutes)
          </label>
          <select
            name="duration"
            value={formData.duration}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={30}>30 minutes (1 credit)</option>
            <option value={60}>60 minutes (2 credits)</option>
            <option value={90}>90 minutes (3 credits)</option>
            <option value={120}>120 minutes (4 credits)</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Any specific topics or questions you'd like to cover..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Credits Required */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Credits Required:</span>
            <span className="text-lg font-semibold text-blue-600">{creditsRequired}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving || !selectedTutor}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Scheduling...
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4" />
              Schedule Meeting
            </>
          )}
        </button>
      </form>

      {/* Tutor Availability */}
      {selectedTutor && tutorAvailability.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <h4 className="text-md font-semibold text-gray-700 mb-4">
            {selectedTutor.tutor_name}'s Availability
          </h4>
          <div className="space-y-2">
            {tutorAvailability.map((slot, index) => (
              <div key={index} className="text-sm text-gray-600">
                {slot.day}: {slot.startTime} - {slot.endTime} UTC
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
