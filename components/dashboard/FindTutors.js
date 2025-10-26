'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Search, Clock, BookOpen, Users } from 'lucide-react';
import BookingModal from './BookingModal';

export default function FindTutors() {
  const { user } = useAuth();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch all tutors
  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const { data, error } = await supabase
          .from('Tutors')
          .select('*')
          .not('user_id', 'eq', user?.id); // Exclude current user

        if (error) {
          console.error('Error fetching tutors:', error);
        } else {
          setTutors(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchTutors();
    }
  }, [user]);

  // Note: Removed request functionality - students now book directly through Meetings page
  
  // Get unique subjects for filter
  const allSubjects = [...new Set(tutors.flatMap(tutor => tutor.subjects || []))];

  // Filter tutors based on search, subject, and availability
  const filteredTutors = tutors.filter(tutor => {
    // Check if tutor has availability
    const hasAvailability = tutor.availability && Array.isArray(tutor.availability) && tutor.availability.length > 0;
    if (!hasAvailability) return false;
    
    const matchesSearch = !searchTerm || 
      tutor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tutor.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = !selectedSubject || 
      (tutor.subjects && tutor.subjects.includes(selectedSubject));
    
    return matchesSearch && matchesSubject;
  });

  // Handle opening booking modal
  const handleOpenBooking = (tutor) => {
    setSelectedTutor(tutor);
    setIsModalOpen(true);
  };

  // Handle closing booking modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTutor(null);
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
        <Search className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Find Tutors</h3>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:w-64">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {allSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tutors List */}
      <div className="space-y-4">
        {filteredTutors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No tutors found matching your criteria.</p>
            {tutors.length === 0 && <p className="text-sm mt-2">No tutors available in the system.</p>}
          </div>
        ) : (
          filteredTutors.map((tutor) => (
            <div key={tutor.user_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{tutor.name || 'Tutor'}</h4>
                    <span className="text-sm text-gray-500">{tutor.email}</span>
                  </div>
                  
                  {/* Subjects */}
                  {tutor.subjects && tutor.subjects.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Subjects:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tutor.subjects.map((subject, index) => (
                          <span
                            key={index}
                            className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                          >
                            {subject}
                          </span>
                        ))}
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
                </div>

                <button
                  onClick={() => handleOpenBooking(tutor)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Book Session
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Booking Modal */}
      <BookingModal 
        tutor={selectedTutor} 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
      />
    </div>
  );
}
