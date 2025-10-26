"use client";

import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function BookSession() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTutor, setSelectedTutor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("");
  const [tutors, setTutors] = useState([]);
  const [studentCredits, setStudentCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch tutors and student data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

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

    fetchData();
  }, [user]);

  // Get unique subjects from tutors
  const subjects = [
    ...new Set(tutors.flatMap((tutor) => tutor.subjects || [])),
  ];

  // Get tutors for selected subject
  const tutorsForSubject = tutors.filter((tutor) => {
    const hasAvailability =
      tutor.availability &&
      Array.isArray(tutor.availability) &&
      tutor.availability.length > 0;
    return (
      hasAvailability &&
      tutor.subjects &&
      tutor.subjects.includes(selectedSubject)
    );
  });

  // Get selected tutor data
  const selectedTutorData = tutors.find(
    (tutor) => tutor.name === selectedTutor
  );

  // Parse tutor availability and get available dates
  const getAvailableDates = () => {
    if (!selectedTutorData?.availability) return [];

    const dates = new Set();
    selectedTutorData.availability.forEach((slot) => {
      if (slot.date) {
        dates.add(slot.date);
      }
    });

    return Array.from(dates).sort((a, b) => new Date(a) - new Date(b));
  };

  // Get available time slots for selected date
  const getAvailableTimeSlots = () => {
    if (!selectedTutorData?.availability || !selectedDate) return [];

    const slots = selectedTutorData.availability.filter(
      (slot) => slot.date === selectedDate
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

    return timeSlots.sort((a, b) => a.minutes - b.minutes);
  };

  // Get available durations based on selected time
  const getAvailableDurations = () => {
    if (!selectedTime) return durations;

    const timeSlots = getAvailableTimeSlots();
    const selectedSlot = timeSlots.find((slot) => slot.time === selectedTime);

    if (!selectedSlot) return durations;

    const remainingMinutes = selectedSlot.endMinutes - selectedSlot.minutes;
    const availableDurations = [];

    durations.forEach((duration) => {
      const durationMinutes =
        duration === "30 mins"
          ? 30
          : duration === "1 hour"
          ? 60
          : duration === "1.5 hours"
          ? 90
          : duration === "2 hours"
          ? 120
          : duration === "2.5 hours"
          ? 150
          : duration === "3 hours"
          ? 180
          : duration === "3.5 hours"
          ? 210
          : 240;

      if (durationMinutes <= remainingMinutes) {
        availableDurations.push(duration);
      }
    });

    return availableDurations;
  };

  const durations = [
    "30 mins",
    "1 hour",
    "1.5 hours",
    "2 hours",
    "2.5 hours",
    "3 hours",
    "3.5 hours",
    "4 hours",
  ];

  // Calculate credits needed based on duration
  const calculateCredits = (duration) => {
    const durationMap = {
      "30 mins": 1,
      "1 hour": 2,
      "1.5 hours": 3,
      "2 hours": 4,
      "2.5 hours": 5,
      "3 hours": 6,
      "3.5 hours": 7,
      "4 hours": 8,
    };
    return durationMap[duration] || 0;
  };

  // Handle booking confirmation
  const handleBooking = async () => {
    if (!selectedTutor || !selectedDate || !selectedTime || !selectedDuration) {
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

    try {
      // Get student and tutor IDs
      const { data: studentData, error: studentError } = await supabase
        .from("Students")
        .select("id, credits")
        .eq("user_id", user.id)
        .single();

      if (studentError) throw studentError;

      const { data: tutorData, error: tutorError } = await supabase
        .from("Tutors")
        .select("id")
        .eq("name", selectedTutor)
        .single();

      if (tutorError) throw tutorError;

      // Calculate start and end times
      const [time, period] = selectedTime.split(" ");
      const [hours, minutes] = time.split(":");
      let hour24 = parseInt(hours);
      if (period === "PM" && hour24 !== 12) hour24 += 12;
      if (period === "AM" && hour24 === 12) hour24 = 0;

      const startTime = new Date(selectedDate);
      startTime.setHours(hour24, parseInt(minutes), 0, 0);

      const endTime = new Date(startTime);
      const durationMinutes =
        selectedDuration === "30 mins"
          ? 30
          : selectedDuration === "1 hour"
          ? 60
          : selectedDuration === "1.5 hours"
          ? 90
          : selectedDuration === "2 hours"
          ? 120
          : selectedDuration === "2.5 hours"
          ? 150
          : selectedDuration === "3 hours"
          ? 180
          : selectedDuration === "3.5 hours"
          ? 210
          : 240;
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      // Create booking request
      const { error: scheduleError } = await supabase.from("Schedules").insert({
        student_id: studentData.id,
        tutor_id: tutorData.id,
        subject: selectedSubject,
        start_time_utc: startTime.toISOString(),
        end_time_utc: endTime.toISOString(),
        duration_min: durationMinutes,
        credits_required: creditsRequired,
        status: "pending",
      });

      if (scheduleError) throw scheduleError;

      // Deduct credits
      const newCredits = studentCredits - creditsRequired;
      const { error: updateCreditsError } = await supabase
        .from("Students")
        .update({ credits: newCredits })
        .eq("id", studentData.id);

      if (updateCreditsError) throw updateCreditsError;

      alert(
        `Session booked!\nTutor: ${selectedTutor}\nDate: ${selectedDate}\nTime: ${selectedTime}\nDuration: ${selectedDuration}\nCredits used: ${creditsRequired}`
      );

      // Reset form
      setStep(1);
      setSelectedSubject("");
      setSelectedTutor("");
      setSelectedDate("");
      setSelectedTime("");
      setSelectedDuration("");
      setStudentCredits(newCredits);
    } catch (error) {
      console.error("Error booking session:", error);
      alert("Error booking session. Please try again.");
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
        <p className="text-slate-500">Step {step} of 5</p>
      </div>

      <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-200">
        {/* Step 1: Subject Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Subject
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => {
                      setSelectedSubject(subject);
                      setStep(2);
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
            </div>
          </div>
        )}

        {/* Step 2: Tutor Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Select a Tutor
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Available tutors for {selectedSubject}
              </p>
              <div className="space-y-3">
                {tutorsForSubject.map((tutor) => (
                  <button
                    key={tutor.user_id}
                    onClick={() => {
                      setSelectedTutor(tutor.name || "Tutor");
                      setStep(3);
                    }}
                    className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-blue-300 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {tutor.name || "Tutor"}
                        </p>
                        <p className="text-sm text-slate-500">{tutor.email}</p>
                      </div>
                      <ChevronRight className="text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Date Selection */}
        {step === 3 && (
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
                          setStep(4);
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

        {/* Step 4: Time Selection */}
        {step === 4 && (
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
                        setStep(5);
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

        {/* Step 5: Duration Selection */}
        {step === 5 && (
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
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Confirm Booking
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
    </div>
  );
}
