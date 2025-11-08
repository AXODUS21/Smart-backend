"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Clock, X, Check, CreditCard } from "lucide-react";

export default function BookingModal({
  tutor,
  isOpen,
  onClose,
  studentCredits,
  subject,
}) {
  const { user } = useAuth();
  const [booking, setBooking] = useState({});
  const [success, setSuccess] = useState("");

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Request a meeting for a specific time slot
  const handleRequestMeeting = async (slot) => {
    const bookingKey = `${slot.date}-${slot.startTime}`;
    setBooking((prev) => ({ ...prev, [bookingKey]: true }));
    setSuccess("");

    try {
      // Calculate start and end times using the slot's date
      const startTime = new Date(`${slot.date}T${slot.startTime}:00Z`);
      const endTime = new Date(`${slot.date}T${slot.endTime}:00Z`);

      // Calculate duration in minutes
      const duration = (endTime - startTime) / (1000 * 60);

      // Calculate credits (1 credit = 30 minutes)
      const creditsRequired = Math.ceil(duration / 30);

      // Get student and tutor IDs (bigint) from their respective tables
      const { data: studentData, error: studentError } = await supabase
        .from("Students")
        .select("id, credits")
        .eq("user_id", user.id)
        .single();

      if (studentError) throw studentError;

      const { data: tutorData, error: tutorError } = await supabase
        .from("Tutors")
        .select("id")
        .eq("user_id", tutor.user_id)
        .single();

      if (tutorError) throw tutorError;

      // Check if student has enough credits
      if (studentData.credits < creditsRequired) {
        alert(
          `Insufficient credits. You need ${creditsRequired} credits but only have ${studentData.credits}.`
        );
        return;
      }

      // Create booking request in Schedules table
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("Schedules")
        .insert({
          student_id: studentData.id,
          tutor_id: tutorData.id,
          subject: subject || "General Session", // Use selected subject
          start_time_utc: startTime.toISOString(),
          end_time_utc: endTime.toISOString(),
          duration_min: duration,
          credits_required: creditsRequired,
          status: "pending",
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // Deduct credits
      const newCredits = studentData.credits - creditsRequired;
      const { error: updateCreditsError } = await supabase
        .from("Students")
        .update({ credits: newCredits })
        .eq("id", studentData.id);

      if (updateCreditsError) throw updateCreditsError;

      setSuccess(`Meeting request sent! ${creditsRequired} credits deducted.`);

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error requesting meeting:", error);
      alert("Error requesting meeting. Please try again.");
    } finally {
      setBooking((prev) => ({ ...prev, [bookingKey]: false }));
    }
  };

  if (!isOpen || !tutor) return null;

  // Group availability by date
  const availabilityByDate = {};
  (tutor.availability || []).forEach((slot) => {
    if (!availabilityByDate[slot.date]) {
      availabilityByDate[slot.date] = [];
    }
    availabilityByDate[slot.date].push(slot);
  });

  // Sort dates
  const sortedDates = Object.keys(availabilityByDate).sort(
    (a, b) => new Date(a) - new Date(b)
  );

  return (
    <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Select Date & Time
            </h3>
            {subject && (
              <p className="text-sm text-slate-600">Subject: {subject}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Credits Display */}
            <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                {studentCredits || 0} Credits
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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

          {/* Availability by Date */}
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div
                key={date}
                className="border border-slate-200 rounded-lg p-4"
              >
                <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {formatDate(date)}
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availabilityByDate[date].map((slot, index) => {
                    const duration =
                      (new Date(`2000-01-01T${slot.endTime}:00Z`) -
                        new Date(`2000-01-01T${slot.startTime}:00Z`)) /
                      (1000 * 60);
                    const creditsRequired = Math.ceil(duration / 30);
                    const bookingKey = `${slot.date}-${slot.startTime}`;

                    return (
                      <button
                        key={index}
                        onClick={() => handleRequestMeeting(slot)}
                        disabled={booking[bookingKey]}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          booking[bookingKey]
                            ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                            : "border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="text-sm">
                          <div className="font-medium text-slate-900">
                            {slot.startTime} - {slot.endTime}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {creditsRequired} credits
                          </div>
                        </div>
                        {booking[bookingKey] && (
                          <div className="flex items-center justify-center mt-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {sortedDates.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>No availability set by this tutor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
