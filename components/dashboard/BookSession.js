"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  X,
  User,
  Award,
  Briefcase,
  BookOpen,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getActiveProfile, buildPrimaryProfileName, DEFAULT_PROFILE_ID } from "@/lib/studentProfiles";

export default function BookSession({ overrideStudentId }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTutor, setSelectedTutor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("");
  const [tutors, setTutors] = useState([]);
  const [studentCredits, setStudentCredits] = useState(0);
  const [studentRecord, setStudentRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTutorForDetails, setSelectedTutorForDetails] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [platformSettings, setPlatformSettings] = useState({
    min_booking_hours_advance: 2,
    max_daily_sessions_per_student: 5,
  });
  const [tutorBookings, setTutorBookings] = useState([]);
  const activeProfile = studentRecord ? getActiveProfile(studentRecord) : null;
  const activeProfileLabel = activeProfile
    ? activeProfile.name
    : studentRecord
    ? buildPrimaryProfileName(studentRecord)
    : null;

  // Fetch tutors and student data
  useEffect(() => {
    const fetchData = async () => {
      if (!user && !overrideStudentId) return;

      try {
        // Fetch tutors
        const { data: tutorsData, error: tutorsError } = await supabase
          .from("Tutors")
          .select("*")
          .not("user_id", "eq", user?.id); // Exclude current user when not override

        if (tutorsError) {
          console.error("Error fetching tutors:", tutorsError);
        } else {
          setTutors(tutorsData || []);
        }

        // Fetch student record and credits
        let studentData = null;
        if (overrideStudentId) {
          // overrideStudentId might be a school ID when principal views as school
          // First check if it's a school - treat school as student entity
          const { data: schoolData } = await supabase
            .from("Schools")
            .select("id, name")
            .eq("id", overrideStudentId)
            .single();

          if (schoolData) {
            // Treat school as student - use school ID as student ID
            studentData = {
              id: schoolData.id,
              first_name: schoolData.name,
              last_name: "",
              isSchool: true,
            };
            // Principal's shared credits when acting as school
            const { data: pri } = await supabase.from("Principals").select("credits").eq("user_id", user?.id).single();
            setStudentCredits(pri?.credits ?? 0);
          } else {
            // Not a school, try as student ID
            const { data, error } = await supabase
              .from("Students")
              .select("id, first_name, last_name, extra_profiles, active_profile_id")
              .eq("id", overrideStudentId)
              .single();
            studentData = data;
            if (error) console.error("Error fetching student:", error);
            // Principal's shared credits when acting as student
            const { data: pri } = await supabase.from("Principals").select("credits").eq("user_id", user?.id).single();
            setStudentCredits(pri?.credits ?? 0);
          }
        } else {
          const { data, error } = await supabase
            .from("Students")
            .select("id, credits, first_name, last_name, extra_profiles, active_profile_id")
            .eq("user_id", user?.id)
            .single();
          studentData = data;
          if (error) console.error("Error fetching student credits:", error);
          if (studentData) setStudentCredits(studentData.credits || 0);
        }
        if (studentData) setStudentRecord(studentData);

        // Fetch platform settings
        const { data: settingsData, error: settingsError } = await supabase
          .from("PlatformSettings")
          .select("setting_key, setting_value");

        if (!settingsError && settingsData) {
          const settingsMap = {};
          settingsData.forEach((setting) => {
            const value = setting.data_type === "integer" 
              ? parseInt(setting.setting_value) 
              : setting.setting_value;
            settingsMap[setting.setting_key] = value;
          });
          setPlatformSettings((prev) => ({ ...prev, ...settingsMap }));
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, overrideStudentId]);

  // Fetch tutor's existing bookings when tutor and date are selected
  useEffect(() => {
    const fetchTutorBookings = async () => {
      if (!selectedTutor || !selectedDate) {
        setTutorBookings([]);
        return;
      }

      // Find the selected tutor's data
      const tutorData = tutors.find((tutor) => {
        const fullName = `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim();
        return fullName === selectedTutor;
      });

      if (!tutorData) {
        setTutorBookings([]);
        return;
      }

      try {
        // Parse date in UTC to avoid timezone issues
        const [year, month, day] = selectedDate.split("-");
        const dateStart = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
        const dateEnd = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59, 999));



        const { data, error } = await supabase
          .from("Schedules")
          .select("start_time_utc, end_time_utc, status")
          .eq("tutor_id", tutorData.id)
          .in("status", ["pending", "confirmed"])
          .gte("start_time_utc", dateStart.toISOString())
          .lte("start_time_utc", dateEnd.toISOString());

        if (error) {
          console.error("Error fetching tutor bookings:", error);
          setTutorBookings([]);
        } else {
          setTutorBookings(data || []);
        }
      } catch (error) {
        console.error("Error:", error);
        setTutorBookings([]);
      }
    };

    fetchTutorBookings();
  }, [selectedTutor, selectedDate, tutors]);

  // Get unique grade levels from tutors (from subject objects)
  const gradeLevels = [
    ...new Set(
      tutors.flatMap((tutor) => {
        if (!tutor.subjects) return [];
        return tutor.subjects
          .filter((subj) => typeof subj === "object" && subj.grade_level)
          .map((subj) => subj.grade_level);
      })
    ),
  ].sort();

  // Get unique subjects filtered by selected grade level
  const subjects = selectedGradeLevel
    ? [
        ...new Set(
          tutors.flatMap((tutor) => {
            if (!tutor.subjects) return [];
            return tutor.subjects
              .filter(
                (subj) =>
                  typeof subj === "object" &&
                  subj.grade_level === selectedGradeLevel
              )
              .map((subj) => (typeof subj === "string" ? subj : subj.subject));
          })
        ),
      ]
    : [];

  // Get tutors for selected subject and grade level
  const tutorsForSubject = tutors.filter((tutor) => {
    const hasAvailability =
      tutor.availability &&
      Array.isArray(tutor.availability) &&
      tutor.availability.length > 0;
    if (!hasAvailability || !tutor.subjects) return false;
    // Check if tutor teaches the selected subject at the selected grade level
    return tutor.subjects.some((subj) => {
      if (typeof subj === "object") {
        const subjectName = subj.subject;
        const gradeLevel = subj.grade_level;
        return (
          subjectName === selectedSubject && gradeLevel === selectedGradeLevel
        );
      }
      return false;
    });
  });

  // Get selected tutor data
  const selectedTutorData = tutors.find((tutor) => {
    const fullName = `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim();
    return fullName === selectedTutor;
  });

  // Helper function to check if a date is in the past
  const isPastDate = (dateString) => {
    if (!dateString) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    const slotDate = new Date(dateString);
    slotDate.setHours(0, 0, 0, 0);
    return slotDate < today;
  };

  // Parse tutor availability and get available dates
  const getAvailableDates = () => {
    if (!selectedTutorData?.availability) return [];

    const now = new Date();
    const minBookingHours = platformSettings.min_booking_hours_advance || 2;
    const minBookingTime = new Date(now.getTime() + minBookingHours * 60 * 60 * 1000);

    const dates = new Set();
    selectedTutorData.availability.forEach((slot) => {
      if (slot.date) {
        // First check if date is in the past
        if (isPastDate(slot.date)) return;
        
        const slotDate = new Date(slot.date);
        // Only include dates that are at least minBookingHours in advance
        if (slotDate >= minBookingTime) {
          dates.add(slot.date);
        }
      }
    });

    return Array.from(dates).sort((a, b) => new Date(a) - new Date(b));
  };

  // Get available time slots for selected date
  const getAvailableTimeSlots = () => {
    if (!selectedTutorData?.availability || !selectedDate) return [];

    const slots = selectedTutorData.availability.filter(
      (slot) => slot.date === selectedDate && !isPastDate(slot.date)
    );
    const timeSlots = [];

    slots.forEach((slot) => {
      const startTime = slot.startTime;
      const endTime = slot.endTime;

      // Convert to 24-hour format for easier calculation
      const parseTime = (timeStr) => {
        const [time, period] = timeStr.split(" ");
        const [hours, minutes] = time.split(":");
        let hour24 = parseInt(hours);
        if (period === "PM" && hour24 !== 12) hour24 += 12;
        if (period === "AM" && hour24 === 12) hour24 = 0;
        return hour24 * 60 + parseInt(minutes); // Convert to minutes from midnight
      };

      const startMinutes = parseTime(startTime);
      const endMinutes = parseTime(endTime);

      // Generate 30-minute slots
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const hour = Math.floor(minutes / 60);
        const min = minutes % 60;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period = hour >= 12 ? "PM" : "AM";
        const timeStr = `${displayHour}:${min
          .toString()
          .padStart(2, "0")} ${period}`;
        timeSlots.push({
          time: timeStr,
          minutes: minutes,
          endMinutes: endMinutes,
        });
      }
    });

    // Filter out time slots that are already booked
    const availableSlots = timeSlots.filter((slot) => {
      // IMPORTANT: Create LOCAL date for this time slot
      // The tutor's availability times (like "7:30 PM") are in LOCAL time, not UTC
      // So we need to create a local Date object, which JavaScript will automatically store as UTC internally
      const [year, month, day] = selectedDate.split("-");
      const slotStartUTC = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        Math.floor(slot.minutes / 60),
        slot.minutes % 60,
        0,
        0
      );

      // Check if this slot overlaps with any existing booking
      const isBooked = tutorBookings.some((booking) => {
        const bookingStart = new Date(booking.start_time_utc);
        const bookingEnd = new Date(booking.end_time_utc);
        
        // Check for any overlap
        // A slot is booked if it starts before the booking ends AND ends after the booking starts
        const slotEndUTC = new Date(slotStartUTC.getTime() + 30 * 60 * 1000); // 30 min slot
        return slotStartUTC < bookingEnd && slotEndUTC > bookingStart;
      });

      return !isBooked;
    });

    return availableSlots.sort((a, b) => a.minutes - b.minutes);
  };

  // Get available durations based on selected time
  const getAvailableDurations = () => {
    if (!selectedTime || !selectedDate) return durations;

    const timeSlots = getAvailableTimeSlots();
    const selectedSlot = timeSlots.find((slot) => slot.time === selectedTime);

    if (!selectedSlot) return durations;

    // Calculate start time for the selected slot
    const [year, month, day] = selectedDate.split("-");
    
    // We need to reconstruct the UTC date for the selected slot start
    // The minutes from selectedSlot are relative to the day start
    // IMPORTANT: Create LOCAL date for this time slot to match getAvailableTimeSlots logic
    const slotStartUTC = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        Math.floor(selectedSlot.minutes / 60),
        selectedSlot.minutes % 60,
        0,
        0
    );

    const availableDurations = [];

    durations.forEach((duration) => {
      const durationMinutes = duration === "30 mins" ? 30 : 60;
      
      // Check if duration fits in availability window
      if (selectedSlot.minutes + durationMinutes <= selectedSlot.endMinutes) {
         // Check for overlap with existing bookings
         const slotEndUTC = new Date(slotStartUTC.getTime() + durationMinutes * 60 * 1000);
         
         const isBooked = tutorBookings.some((booking) => {
            const bookingStart = new Date(booking.start_time_utc);
            const bookingEnd = new Date(booking.end_time_utc);
            
            // Check for any overlap
            // A duration is invalid if it overlaps with an existing booking
            return slotStartUTC < bookingEnd && slotEndUTC > bookingStart;
         });
         
         if (!isBooked) {
             availableDurations.push(duration);
         }
      }
    });

    return availableDurations;
  };

  const durations = ["30 mins", "1 hour"];

  // Calculate credits needed based on duration
  const calculateCredits = (duration) => {
    const durationMap = {
      "30 mins": 1,
      "1 hour": 2,
    };
    return durationMap[duration] || 0;
  };

  const [isBooking, setIsBooking] = useState(false); // Add isBooking state

  // Handle booking confirmation
  const handleBooking = async () => {
    if (
      !selectedGradeLevel ||
      !selectedSubject ||
      !selectedTutor ||
      !selectedDate ||
      !selectedTime ||
      !selectedDuration
    ) {
      alert("Please complete all selections before booking.");
      return;
    }

    if (!selectedTutorData) {
      alert("Tutor data not found. Please try again.");
      return;
    }

    const creditsRequired = calculateCredits(selectedDuration);

    if (studentCredits < creditsRequired) {
      alert(
        `Insufficient credits. You need ${creditsRequired} credits but only have ${studentCredits}.`
      );
      return;
    }

    setIsBooking(true); // Disable button immediately

    try {
      const usePrincipalCredits = Boolean(overrideStudentId);
      // Get student and tutor IDs
      let studentData = null;
      if (overrideStudentId) {
        // First check if it's a school - treat school as student entity
        const { data: schoolData } = await supabase
          .from("Schools")
          .select("id, name")
          .eq("id", overrideStudentId)
          .single();

        if (schoolData) {
          // Treat school as student
          studentData = {
            id: schoolData.id,
            first_name: schoolData.name,
            last_name: "",
            isSchool: true,
          };
        } else {
          // Not a school, try as student ID
          const { data, error } = await supabase
            .from("Students")
            .select("id, first_name, last_name, extra_profiles, active_profile_id")
            .eq("id", overrideStudentId)
            .single();
          if (error) throw error;
          studentData = data;
        }
      } else {
        const { data, error } = await supabase
          .from("Students")
          .select("id, credits, first_name, last_name, extra_profiles, active_profile_id")
          .eq("user_id", user.id)
          .single();
        if (error) throw error;
        studentData = data;
      }

      // Use selectedTutorData directly since we already have it from the tutors array
      if (!selectedTutorData) {
        throw new Error("Tutor data not found");
      }

      const tutorData = {
        id: selectedTutorData.id,
        email: selectedTutorData.email,
        first_name: selectedTutorData.first_name,
        last_name: selectedTutorData.last_name,
      };

      // Calculate start and end times with proper UTC conversion
      const [time, period] = selectedTime.split(" ");
      const [hours, minutes] = time.split(":");
      let hour24 = parseInt(hours);
      
      // Correct AM/PM to 24-hour conversion
      if (period === "PM" && hour24 !== 12) {
        hour24 += 12;
      } else if (period === "AM" && hour24 === 12) {
        hour24 = 0;
      }

      // Parse date string (YYYY-MM-DD format from input)
      const [year, month, day] = selectedDate.split("-");
      
      // Create a UTC date directly with the selected date and time
      const startTimeUTC = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed
        parseInt(day),
        hour24,
        parseInt(minutes),
        0,
        0
      ));

      const endTime = new Date(startTimeUTC);
      const durationMinutes = selectedDuration === "30 mins" ? 30 : 60;
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      // Check daily session limit for student
      const profileIdForInsert = studentData.active_profile_id || DEFAULT_PROFILE_ID;
      const profileInfo = getActiveProfile(studentData);
      const profileNameForInsert =
        profileInfo?.name || buildPrimaryProfileName(studentData);

      const { data: existingSessions, error: sessionCheckError } = await supabase
        .from("Schedules")
        .select("id")
        .eq("student_id", studentData.id)
        .eq("profile_id", profileIdForInsert)
        .eq("status", "confirmed")
        .gte("start_time_utc", new Date(selectedDate).toISOString().split('T')[0])
        .lt("start_time_utc", new Date(new Date(selectedDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (sessionCheckError) throw sessionCheckError;

      const maxDailySessions = platformSettings.max_daily_sessions_per_student || 5;
      if (existingSessions && existingSessions.length >= maxDailySessions) {
        alert(
          `You have reached the maximum of ${maxDailySessions} sessions per day. Please choose a different date.`
        );
        setIsBooking(false);
        return;
      }

      // Check for double booking - ensure tutor doesn't have overlapping sessions
      const { data: tutorExistingSessions, error: tutorSessionCheckError } = await supabase
        .from("Schedules")
        .select("id, start_time_utc, end_time_utc, status")
        .eq("tutor_id", tutorData.id)
        .in("status", ["pending", "confirmed"])
        .or(`and(start_time_utc.lt.${endTime.toISOString()},end_time_utc.gt.${startTimeUTC.toISOString()})`);

      if (tutorSessionCheckError) throw tutorSessionCheckError;

      if (tutorExistingSessions && tutorExistingSessions.length > 0) {
        alert(
          `This time slot is no longer available. The tutor already has a session booked at this time. Please select a different time.`
        );
        setIsBooking(false);
        return;
      }

      // Create booking request with correct UTC times
      const insertPayload = {
        tutor_id: tutorData.id,
        subject: selectedSubject,
        start_time_utc: startTimeUTC.toISOString(),
        end_time_utc: endTime.toISOString(),
        duration_min: durationMinutes,
        credits_required: creditsRequired,
        profile_id: profileIdForInsert,
        profile_name: profileNameForInsert,
        status: "pending",
      };
      
      // Set student_id or school_id based on whether this is a school booking
      if (studentData.isSchool) {
        insertPayload.school_id = studentData.id;
        insertPayload.principal_user_id = user.id;
      } else {
        insertPayload.student_id = studentData.id;
        if (usePrincipalCredits) insertPayload.principal_user_id = user.id;
      }

      const { error: scheduleError } = await supabase.from("Schedules").insert(insertPayload);

      if (scheduleError) throw scheduleError;

      // Deduct credits: from Principals when acting as student, else Students
      const newCredits = studentCredits - creditsRequired;
      if (usePrincipalCredits) {
        const { error: updateCreditsError } = await supabase
          .from("Principals")
          .update({ credits: newCredits })
          .eq("user_id", user.id);
        if (updateCreditsError) throw updateCreditsError;
      } else {
        const { error: updateCreditsError } = await supabase
          .from("Students")
          .update({ credits: newCredits })
          .eq("id", studentData.id);
        if (updateCreditsError) throw updateCreditsError;
      }

      // Check for low credits and send notification
      if (newCredits <= 1) {
        try {
          const { notifyLowCredits } = await import('@/lib/notificationService');
          const recipientEmail = usePrincipalCredits ? (user?.email) : (studentData.email);
          const recipientName = usePrincipalCredits ? "Principal" : (`${studentData.first_name || ''} ${studentData.last_name || ''}`.trim() || 'Student');
          if (recipientEmail) {
            await notifyLowCredits(recipientEmail, recipientName, newCredits);
            console.log('Low credits notification sent');
          }
        } catch (notifError) {
          console.error('Failed to send low credits notification:', notifError);
        }
      }

      // Send session booking notification
      try {
        const { notifySessionBooking } = await import('@/lib/notificationService');
        const { getTutorEmailById, getStudentEmailById } = await import('@/lib/notifications');
        
        const tutorEmail = tutorData.email || await getTutorEmailById(tutorData.id);
        const studentEmail = studentData.email || await getStudentEmailById(studentData.id);
        const studentName = `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim() || 'Student';
        const tutorName = `${tutorData.first_name || ''} ${tutorData.last_name || ''}`.trim() || selectedTutor;
        
        // Format date and time for display
        const sessionDate = new Date(selectedDate).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        if (tutorEmail && studentEmail) {
          await notifySessionBooking(
            studentEmail,
            studentName,
            tutorEmail,
            tutorName,
            sessionDate,
            selectedTime,
            selectedSubject,
            'booked'
          );
          console.log('Session booking notification sent');
        }
      } catch (notifError) {
        console.error('Failed to send session booking notification:', notifError);
        // Don't fail booking if notification fails
      }

      alert(
        `Session booked!\nTutor: ${selectedTutor}\nGrade Level: ${selectedGradeLevel}\nSubject: ${selectedSubject}\nDate: ${selectedDate}\nTime: ${selectedTime}\nDuration: ${selectedDuration}\nCredits used: ${creditsRequired}`
      );

      // Reset form
      setStep(1);
      setSelectedGradeLevel("");
      setSelectedSubject("");
      setSelectedTutor("");
      setSelectedDate("");
      setSelectedTime("");
      setSelectedDuration("");
      setStudentCredits(newCredits);
      if (!usePrincipalCredits) {
        setStudentRecord((prev) => (prev ? { ...prev, credits: newCredits } : prev));
      }
    } catch (error) {
      console.error("Error booking session:", error);
      alert("Error booking session. Please try again.");
    } finally {
      setIsBooking(false); // Re-enable button
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Book a Session
          </h2>
          <p className="text-slate-500">Loading...</p>
        </div>
        <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-200">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Book a Session
        </h2>
        <p className="text-slate-500">Step {step} of 6</p>
        {activeProfileLabel && (
          <p className="text-xs text-slate-500 mt-1">
            Booking for <span className="font-medium">{activeProfileLabel}</span>. Change active profile in Student Settings.
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-200">
        {/* Step 1: Grade Level Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Grade Level
              </h3>
              {gradeLevels.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No grade levels available.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {gradeLevels.map((grade) => (
                    <button
                      key={grade}
                      onClick={() => {
                        setSelectedGradeLevel(grade);
                        setSelectedSubject("");
                        setSelectedTutor("");
                        setSelectedDate("");
                        setSelectedTime("");
                        setSelectedDuration("");
                        setStep(2);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedGradeLevel === grade
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <p className="font-medium text-slate-900">{grade}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Subject Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Subject
              </h3>
              {subjects.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No subjects available for {selectedGradeLevel}.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {subjects.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => {
                        setSelectedSubject(subject);
                        setSelectedTutor("");
                        setSelectedDate("");
                        setSelectedTime("");
                        setSelectedDuration("");
                        setStep(3);
                      }}
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
              )}
            </div>
          </div>
        )}

        {/* Step 3: Tutor Selection */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Tutor
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Available tutors for {selectedSubject} at {selectedGradeLevel}
              </p>
              <div className="space-y-3">
                {tutorsForSubject.map((tutor) => (
                  <div
                    key={tutor.user_id}
                    className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {`${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || "Tutor"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTutorForDetails(tutor);
                            setIsDetailsModalOpen(true);
                            setImageError(false); // Reset image error when opening modal
                          }}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            const fullName = `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim();
                            setSelectedTutor(fullName || "Tutor");
                            setStep(4);
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ChevronRight className="text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Date Selection */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Date
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Available dates for {selectedTutor}
              </p>
              {getAvailableDates().length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No available dates for this tutor.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {getAvailableDates().map((date) => {
                    const dateObj = new Date(date);
                    const formattedDate = dateObj.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <button
                        key={date}
                        onClick={() => {
                          setSelectedDate(date);
                          setStep(5);
                        }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          selectedDate === date
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <p className="font-medium text-slate-900">
                          {formattedDate}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Time Selection */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Time
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Available times on{" "}
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : ""}
              </p>
              {getAvailableTimeSlots().length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No available times for this date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {getAvailableTimeSlots().map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => {
                        setSelectedTime(slot.time);
                        setSelectedDuration(""); // Reset duration when time changes
                        setStep(6);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedTime === slot.time
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <p className="font-medium text-slate-900">{slot.time}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Duration Selection */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select Duration
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Session will be on{" "}
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : ""}{" "}
                at {selectedTime}
              </p>
              {getAvailableDurations().length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No available durations for this time slot.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {getAvailableDurations().map((duration) => (
                    <button
                      key={duration}
                      onClick={() => setSelectedDuration(duration)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedDuration === duration
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <p className="font-medium text-slate-900">{duration}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedDuration && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">Credits needed:</span>{" "}
                    {calculateCredits(selectedDuration)} credits
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">Your credits:</span>{" "}
                    {studentCredits} credits
                  </p>
                </div>
              )}

              <button
                onClick={handleBooking}
                disabled={isBooking}
                className={`w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors ${
                  isBooking ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                {isBooking ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Confirm Booking"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* Tutor Details Modal */}
      {isDetailsModalOpen && selectedTutorForDetails && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Tutor Profile
                </h2>
                <p className="text-slate-500 mt-1">
                  View tutor profile information
                </p>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content - Matching TutorProfile view design */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Photo and Basic Info */}
                <div className="lg:col-span-1 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                  <div className="flex flex-col items-center">
                    {selectedTutorForDetails.photo_url && !imageError ? (
                      <img
                        src={selectedTutorForDetails.photo_url}
                        alt={`${selectedTutorForDetails.first_name || ''} ${selectedTutorForDetails.last_name || ''}`.trim() || "Tutor"}
                        className="w-32 h-32 rounded-full object-cover border-4 border-slate-200 mb-4"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                        <User size={48} className="text-slate-400" />
                      </div>
                    )}
                    <h3 className="text-xl font-semibold text-slate-900 mb-1">
                      {`${selectedTutorForDetails.first_name || ''} ${selectedTutorForDetails.last_name || ''}`.trim() || "Tutor"}
                    </h3>
                  </div>
                </div>

                {/* Bio */}
                <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="text-blue-600" size={20} />
                    <h3 className="text-lg font-semibold text-slate-900">
                      About Me
                    </h3>
                  </div>
                  {selectedTutorForDetails.bio ? (
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedTutorForDetails.bio}
                    </p>
                  ) : (
                    <p className="text-slate-400 italic">No bio added yet.</p>
                  )}
                </div>

                {/* Subjects */}
                {selectedTutorForDetails.subjects &&
                  selectedTutorForDetails.subjects.length > 0 && (
                    <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="text-blue-600" size={20} />
                        <h3 className="text-lg font-semibold text-slate-900">
                          Subjects & Grade Levels
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTutorForDetails.subjects.map(
                          (subjectObj, index) => {
                            const subject =
                              typeof subjectObj === "string"
                                ? subjectObj
                                : subjectObj.subject;
                            const gradeLevel =
                              typeof subjectObj === "object"
                                ? subjectObj.grade_level
                                : null;
                            return (
                              <span
                                key={index}
                                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                              >
                                {subject}
                                {gradeLevel && (
                                  <span className="text-blue-600 ml-1">
                                    • {gradeLevel}
                                  </span>
                                )}
                              </span>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                {/* Skills */}
                {selectedTutorForDetails.skills &&
                  selectedTutorForDetails.skills.length > 0 && (
                    <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="text-blue-600" size={20} />
                        <h3 className="text-lg font-semibold text-slate-900">
                          Skills
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTutorForDetails.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Experience */}
                {selectedTutorForDetails.experience &&
                  selectedTutorForDetails.experience.length > 0 && (
                    <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="text-blue-600" size={20} />
                        <h3 className="text-lg font-semibold text-slate-900">
                          Experience
                        </h3>
                      </div>
                      <div className="space-y-4">
                        {selectedTutorForDetails.experience.map(
                          (exp, index) => (
                            <div
                              key={exp.id || index}
                              className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              <h4 className="font-semibold text-slate-900">
                                {exp.title}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {exp.company}
                              </p>
                              {exp.duration && (
                                <p className="text-sm text-slate-500 mt-1">
                                  {exp.duration}
                                </p>
                              )}
                              {exp.description && (
                                <p className="text-sm text-slate-700 mt-2">
                                  {exp.description}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Certifications */}
                {selectedTutorForDetails.certifications &&
                  selectedTutorForDetails.certifications.length > 0 && (
                    <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2 mb-4">
                        <Award className="text-blue-600" size={20} />
                        <h3 className="text-lg font-semibold text-slate-900">
                          Certifications
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {selectedTutorForDetails.certifications.map(
                          (cert, index) => (
                            <a
                              key={index}
                              href={cert}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-blue-600 hover:text-blue-800 text-sm truncate"
                            >
                              {cert}
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Empty State */}
                {!selectedTutorForDetails.bio &&
                  (!selectedTutorForDetails.skills ||
                    selectedTutorForDetails.skills.length === 0) &&
                  (!selectedTutorForDetails.experience ||
                    selectedTutorForDetails.experience.length === 0) &&
                  (!selectedTutorForDetails.certifications ||
                    selectedTutorForDetails.certifications.length === 0) &&
                  (!selectedTutorForDetails.subjects ||
                    selectedTutorForDetails.subjects.length === 0) && (
                    <div className="lg:col-span-3 text-center py-8 text-slate-500">
                      <User className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <p>This tutor hasn't added profile details yet.</p>
                    </div>
                  )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const fullName = `${selectedTutorForDetails.first_name || ''} ${selectedTutorForDetails.last_name || ''}`.trim();
                  setSelectedTutor(fullName || "Tutor");
                  setIsDetailsModalOpen(false);
                  setStep(4);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Book This Tutor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
