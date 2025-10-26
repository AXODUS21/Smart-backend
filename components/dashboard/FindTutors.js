'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Search, Clock, BookOpen, Users, ArrowLeft, CreditCard } from 'lucide-react';
import BookingModal from './BookingModal';

export default function FindTutors() {
  const { user } = useAuth();
  const [tutors, setTutors] = useState([]);
  const [studentCredits, setStudentCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState('subjects'); // 'subjects', 'tutors', 'booking'

  // Fetch all tutors and student credits
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tutors
        const { data: tutorsData, error: tutorsError } = await supabase
          .from('Tutors')
          .select('*')
          .not('user_id', 'eq', user?.id); // Exclude current user

        if (tutorsError) {
          console.error('Error fetching tutors:', tutorsError);
        } else {
          setTutors(tutorsData || []);
        }

        // Fetch student credits
        const { data: studentData, error: studentError } = await supabase
          .from('Students')
          .select('credits')
          .eq('user_id', user?.id)
          .single();

        if (studentError) {
          console.error('Error fetching student credits:', studentError);
        } else {
          setStudentCredits(studentData?.credits || 0);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

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

  // Get tutors for selected subject
  const tutorsForSubject = tutors.filter(tutor => {
    const hasAvailability = tutor.availability && Array.isArray(tutor.availability) && tutor.availability.length > 0;
    return hasAvailability && tutor.subjects && tutor.subjects.includes(selectedSubject);
  });

  // Handle subject selection
  const handleSubjectSelect = (subject) => {
    setSelectedSubject(subject);
    setCurrentStep('tutors');
  };

  // Handle tutor selection
  const handleTutorSelect = (tutor) => {
    setSelectedTutor(tutor);
    setCurrentStep('booking');
    setIsModalOpen(true);
  };

  // Handle back navigation
  const handleBack = () => {
    if (currentStep === 'tutors') {
      setCurrentStep('subjects');
      setSelectedSubject('');
    } else if (currentStep === 'booking') {
      setCurrentStep('tutors');
      setSelectedTutor(null);
      setIsModalOpen(false);
    }
  };

  // Handle closing booking modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTutor(null);
    setCurrentStep('tutors');
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Search className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Find Tutors</h3>
        </div>
        
        {/* Credits Display */}
        <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
          <CreditCard className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            {studentCredits} Credits Available
          </span>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          currentStep === 'subjects' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            currentStep === 'subjects' ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'
          }`}>
            1
          </div>
          <span className="text-sm font-medium">Choose Subject</span>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          currentStep === 'tutors' ? 'bg-blue-100 text-blue-800' : 
          currentStep === 'booking' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            currentStep === 'tutors' || currentStep === 'booking' ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'
          }`}>
            2
          </div>
          <span className="text-sm font-medium">Select Tutor</span>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          currentStep === 'booking' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            currentStep === 'booking' ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'
          }`}>
            3
          </div>
          <span className="text-sm font-medium">Book Session</span>
        </div>
      </div>

      {/* Step 1: Subject Selection */}
      {currentStep === 'subjects' && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Choose a Subject</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allSubjects.map((subject) => (
              <button
                key={subject}
                onClick={() => handleSubjectSelect(subject)}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900">{subject}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {tutorsForSubject.filter(tutor => tutor.subjects?.includes(subject)).length} tutors available
                </p>
              </button>
            ))}
          </div>
          
          {allSubjects.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No subjects available.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Tutor Selection */}
      {currentStep === 'tutors' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Subjects
            </button>
            <h4 className="text-lg font-semibold text-gray-900">
              Tutors for {selectedSubject}
            </h4>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search tutors by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          {/* Tutors List */}
          <div className="space-y-4">
            {filteredTutors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No tutors found for {selectedSubject}.</p>
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
                      onClick={() => handleTutorSelect(tutor)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      <BookOpen className="h-4 w-4" />
                      Select Tutor
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal 
        tutor={selectedTutor} 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        studentCredits={studentCredits}
        subject={selectedSubject}
      />
    </div>
  );
}
