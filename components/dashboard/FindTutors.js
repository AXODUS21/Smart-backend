"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { BookOpen, Users, ChevronRight } from "lucide-react";
import BookingModal from "./BookingModal";

export default function FindTutors() {
  const { user } = useAuth();
  const [tutors, setTutors] = useState([]);
  const [studentCredits, setStudentCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: subjects, 2: tutors, 3: booking

  // Fetch all tutors and student credits
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tutors
        const { data: tutorsData, error: tutorsError } = await supabase
          .from("Tutors")
          .select("*")
          .not("user_id", "eq", user?.id); // Exclude current user

        if (tutorsError) {
          console.error("Error fetching tutors:", tutorsError);
        } else {
          setTutors(tutorsData || []);
        }

        // Fetch student credits
        const { data: studentData, error: studentError } = await supabase
          .from("Students")
          .select("credits")
          .eq("user_id", user?.id)
          .single();

        if (studentError) {
          console.error("Error fetching student credits:", studentError);
        } else {
          setStudentCredits(studentData?.credits || 0);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  // Get unique subjects for filter (extract subject names from objects)
  const allSubjects = [
    ...new Set(
      tutors.flatMap((tutor) => {
        if (!tutor.subjects) return [];
        return tutor.subjects.map((subj) =>
          typeof subj === 'string' ? subj : subj.subject
        );
      })
    ),
  ];

  // Filter tutors based on search, subject, and availability
  const filteredTutors = tutors.filter((tutor) => {
    // Check if tutor has availability
    const hasAvailability =
      tutor.availability &&
      Array.isArray(tutor.availability) &&
      tutor.availability.length > 0;
    if (!hasAvailability) return false;

    const matchesSearch =
      !searchTerm ||
      tutor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tutor.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject =
      !selectedSubject ||
      (tutor.subjects &&
        tutor.subjects.some((subj) => {
          const subjectName = typeof subj === 'string' ? subj : subj.subject;
          return subjectName === selectedSubject;
        }));

    return matchesSearch && matchesSubject;
  });

  // Get tutors for selected subject
  const tutorsForSubject = tutors.filter((tutor) => {
    const hasAvailability =
      tutor.availability &&
      Array.isArray(tutor.availability) &&
      tutor.availability.length > 0;
    if (!hasAvailability || !tutor.subjects) return false;
    // Check if tutor teaches the selected subject (at any grade level)
    return tutor.subjects.some((subj) => {
      const subjectName = typeof subj === 'string' ? subj : subj.subject;
      return subjectName === selectedSubject;
    });
  });

  // Handle subject selection
  const handleSubjectSelect = (subject) => {
    setSelectedSubject(subject);
    setCurrentStep(2);
  };

  // Handle tutor selection
  const handleTutorSelect = (tutor) => {
    setSelectedTutor(tutor);
    setCurrentStep(3);
    setIsModalOpen(true);
  };

  // Handle closing booking modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTutor(null);
    setCurrentStep(1);
    setSelectedSubject("");
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Book a Session
        </h2>
        <p className="text-slate-500">Step {currentStep} of 3</p>
      </div>

      <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-200">
        {/* Step 1: Subject Selection */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Subject
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allSubjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => handleSubjectSelect(subject)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedSubject === subject
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <p className="font-medium text-slate-900">{subject}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Tutor Selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Tutor
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Available tutors for {selectedSubject}
              </p>

              {/* Search */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search tutors by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {filteredTutors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No tutors found for {selectedSubject}.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTutors.map((tutor) => (
                    <button
                      key={tutor.user_id}
                      onClick={() => handleTutorSelect(tutor)}
                      className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 transition-all text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {tutor.name || "Tutor"}
                          </p>
                        </div>
                        <ChevronRight className="text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Booking - handled by modal */}
      </div>

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
