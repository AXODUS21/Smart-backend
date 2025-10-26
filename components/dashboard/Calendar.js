'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, Clock, Plus, X, Check, Globe } from 'lucide-react';

export default function Calendar() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    day: '',
    startTime: '',
    endTime: '',
    timezone: 'UTC'
  });

  // Days of the week
  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
    'Friday', 'Saturday', 'Sunday'
  ];

  // Fetch tutor's availability
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('Tutors')
          .select('availability')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching availability:', error);
        } else {
          setAvailability(data?.availability || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [user]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new availability slot
  const handleAddAvailability = async (e) => {
    e.preventDefault();
    if (!formData.day || !formData.startTime || !formData.endTime) return;

    setSaving(true);
    setSuccess('');

    try {
      const newSlot = {
        day: formData.day,
        startTime: formData.startTime,
        endTime: formData.endTime,
        timezone: 'UTC',
        id: Date.now() // Simple ID for local state management
      };

      const updatedAvailability = [...availability, newSlot];
      
      const { error } = await supabase
        .from('Tutors')
        .update({ availability: updatedAvailability })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setAvailability(updatedAvailability);
      setFormData({ day: '', startTime: '', endTime: '', timezone: 'UTC' });
      setShowAddForm(false);
      setSuccess(`Added availability for ${formData.day} ${formData.startTime}-${formData.endTime} UTC`);
    } catch (error) {
      console.error('Error adding availability:', error);
      alert('Error adding availability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Remove availability slot
  const handleRemoveAvailability = async (index) => {
    setSaving(true);
    setSuccess('');

    try {
      const updatedAvailability = availability.filter((_, i) => i !== index);
      
      const { error } = await supabase
        .from('Tutors')
        .update({ availability: updatedAvailability })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setAvailability(updatedAvailability);
      setSuccess('Availability slot removed successfully');
    } catch (error) {
      console.error('Error removing availability:', error);
      alert('Error removing availability. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Format time for display
  const formatTime = (time) => {
    return time || 'Not set';
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            My Availability
          </h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Time Slot
        </button>
      </div>

      {/* UTC Timezone Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-blue-800">
          <Globe className="h-4 w-4" />
          <span className="text-sm font-medium">
            All times are displayed in UTC timezone
          </span>
        </div>
      </div>

      {/* Add Availability Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-md font-semibold text-gray-700 mb-4">
            Add New Time Slot
          </h4>
          <form onSubmit={handleAddAvailability} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Week
                </label>
                <select
                  name="day"
                  value={formData.day}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option className="text-gray-700" value="">
                    Select day
                  </option>
                  {daysOfWeek.map((day) => (
                    <option className="text-gray-700" key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
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
                  className="w-full px-3 text-gray-800 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time (UTC)
                </label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-gray-800 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Add Time Slot
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Current Availability */}
      <div>
        <h4 className="text-md font-semibold text-gray-700 mb-4">
          Your Available Times ({availability.length} slots)
        </h4>

        {availability.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No availability slots added yet.</p>
            <p className="text-sm">Click "Add Time Slot" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availability.map((slot, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {slot.day}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      {slot.startTime} - {slot.endTime}
                    </span>
                    <span className="text-sm text-gray-500">UTC</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAvailability(index)}
                  disabled={saving}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mt-4 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}
    </div>
  );
}
