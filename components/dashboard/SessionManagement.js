"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function SessionManagement() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState({
    min_booking_hours_advance: 2,
    cancellation_notice_hours: 24,
    rescheduling_notice_hours: 24,
  });
  const [selectedSession, setSelectedSession] = useState(null);
  const [actionType, setActionType] = useState(null); // 'cancel' or 'reschedule'
  const [cancellationReason, setCancellationReason] = useState("");
  const [reschedulingData, setReschedulingData] = useState({
    newDate: "",
    newTime: "",
  });
  const [processing, setProcessing] = useState(false);
  const [tutorAvailability, setTutorAvailability] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);

  // Fetch sessions and platform settings
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch student ID
        const { data: studentData } = await supabase
          .from("Students")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!studentData) return;

        // Fetch upcoming sessions (exclude cancelled and rescheduled)
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("Schedules")
          .select(
            `
            *,
            tutor:tutor_id (
              first_name,
              last_name,
              email,
              availability
            )
          `
          )
          .eq("student_id", studentData.id)
          .gt("start_time_utc", new Date().toISOString())
          .not("status", "in", "(cancelled,rescheduled)")
          .order("start_time_utc", { ascending: true });

        if (sessionsError) {
          console.error("Error fetching sessions:", sessionsError);
        } else {
          setSessions(sessionsData || []);
        }

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
  }, [user]);

  // Check if cancellation is allowed
  const canCancelSession = (session) => {
    const now = new Date();
    const sessionStart = new Date(session.start_time_utc);
    const hoursUntilSession = (sessionStart - now) / (1000 * 60 * 60);
    const requiredHours = platformSettings.cancellation_notice_hours || 24;
    return hoursUntilSession >= requiredHours;
  };

  // Check if rescheduling is allowed
  const canRescheduleSession = (session) => {
    const now = new Date();
    const sessionStart = new Date(session.start_time_utc);
    const hoursUntilSession = (sessionStart - now) / (1000 * 60 * 60);
    const requiredHours = platformSettings.rescheduling_notice_hours || 24;
    return hoursUntilSession >= requiredHours;
  };

  // Get hours until session
  const getHoursUntilSession = (session) => {
    const now = new Date();
    const sessionStart = new Date(session.start_time_utc);
    return Math.round((sessionStart - now) / (1000 * 60 * 60) * 10) / 10;
  };

  // Get available dates from tutor availability
  const getAvailableDatesForReschedule = (tutor) => {
    if (!tutor?.availability) return [];

    const now = new Date();
    const minBookingHours = platformSettings.min_booking_hours_advance || 2;
    const minBookingTime = new Date(now.getTime() + minBookingHours * 60 * 60 * 1000);

    const dates = new Set();
    tutor.availability.forEach((slot) => {
      if (slot.date) {
        const slotDate = new Date(slot.date);
        if (slotDate >= minBookingTime) {
          dates.add(slot.date);
        }
      }
    });

    return Array.from(dates).sort((a, b) => new Date(a) - new Date(b));
  };

  // Get available times for selected date from tutor availability
  const getAvailableTimesForReschedule = (tutor, selectedDate) => {
    if (!tutor?.availability || !selectedDate) return [];

    const slots = tutor.availability.filter((slot) => slot.date === selectedDate);
    const timeSlots = [];

    slots.forEach((slot) => {
      const startTime = slot.startTime;
      const endTime = slot.endTime;

      const parseTime = (timeStr) => {
        const [time, period] = timeStr.split(" ");
        const [hours, minutes] = time.split(":");
        let hour24 = parseInt(hours);
        if (period === "PM" && hour24 !== 12) hour24 += 12;
        if (period === "AM" && hour24 === 12) hour24 = 0;
        return hour24 * 60 + parseInt(minutes);
      };

      const startMinutes = parseTime(startTime);
      const endMinutes = parseTime(endTime);

      for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const hour = Math.floor(minutes / 60);
        const min = minutes % 60;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period = hour >= 12 ? "PM" : "AM";
        const timeStr = `${displayHour}:${min.toString().padStart(2, "0")} ${period}`;
        timeSlots.push(timeStr);
      }
    });

    return timeSlots.sort();
  };

  // Handle cancellation
  const handleCancellation = async () => {
    if (!selectedSession || !cancellationReason.trim()) {
      alert("Please provide a cancellation reason.");
      return;
    }

    if (!canCancelSession(selectedSession)) {
      const hoursUntilSession = getHoursUntilSession(selectedSession);
      alert(
        `Cancellations must be made at least ${platformSettings.cancellation_notice_hours} hours in advance. Your session is in ${hoursUntilSession} hours.`
      );
      return;
    }

    setProcessing(true);
    try {
      // Update session with cancellation info
      const { error: updateError } = await supabase
        .from("Schedules")
        .update({
          status: "cancelled",
          cancellation_requested_at: new Date().toISOString(),
          cancellation_reason: cancellationReason,
          cancellation_status: "approved",
          credits_refunded: selectedSession.credits_required,
        })
        .eq("id", selectedSession.id);

      if (updateError) throw updateError;

      // Refund credits to student
      const { data: studentData } = await supabase
        .from("Students")
        .select("credits")
        .eq("id", selectedSession.student_id)
        .single();

      if (studentData) {
        const newCredits = (studentData.credits || 0) + selectedSession.credits_required;
        await supabase
          .from("Students")
          .update({ credits: newCredits })
          .eq("id", selectedSession.student_id);
      }

      // Create notification for tutor about cancellation
      const studentName = studentData?.name || "A student";
      const notificationMessage = `${studentName} cancelled a session scheduled for ${new Date(selectedSession.start_time_utc).toLocaleDateString()} at ${new Date(selectedSession.start_time_utc).toLocaleTimeString()}. Reason: ${cancellationReason}`;
      
      // Store notification in a notifications table or send email
      // For now, we'll log it and you can add email notification later
      console.log("Tutor Notification:", notificationMessage);

      alert("Session cancelled successfully. Credits have been refunded.");
      setSessions(sessions.filter((s) => s.id !== selectedSession.id));
      setSelectedSession(null);
      setActionType(null);
      setCancellationReason("");
    } catch (error) {
      console.error("Error cancelling session:", error);
      alert("Error cancelling session. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // Handle rescheduling
  const handleRescheduling = async () => {
    if (!selectedSession || !reschedulingData.newDate || !reschedulingData.newTime) {
      alert("Please select a new date and time.");
      return;
    }

    if (!canRescheduleSession(selectedSession)) {
      const hoursUntilSession = getHoursUntilSession(selectedSession);
      alert(
        `Rescheduling must be done at least ${platformSettings.rescheduling_notice_hours} hours in advance. Your session is in ${hoursUntilSession} hours.`
      );
      return;
    }

    // Validate that selected time is within tutor availability
    const availableTimes = getAvailableTimesForReschedule(selectedSession.tutor, reschedulingData.newDate);
    if (!availableTimes.includes(reschedulingData.newTime)) {
      alert("The selected time is not available. Please choose from the available times.");
      return;
    }

    setProcessing(true);
    try {
      // Parse new time
      const [time, period] = reschedulingData.newTime.split(" ");
      const [hours, minutes] = time.split(":");
      let hour24 = parseInt(hours);
      if (period === "PM" && hour24 !== 12) hour24 += 12;
      if (period === "AM" && hour24 === 12) hour24 = 0;

      const newStartTime = new Date(reschedulingData.newDate);
      newStartTime.setHours(hour24, parseInt(minutes), 0, 0);

      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + selectedSession.duration_min);

      // Create new session
      const { data: newSession, error: insertError } = await supabase
        .from("Schedules")
        .insert({
          student_id: selectedSession.student_id,
          tutor_id: selectedSession.tutor_id,
          subject: selectedSession.subject,
          start_time_utc: newStartTime.toISOString(),
          end_time_utc: newEndTime.toISOString(),
          duration_min: selectedSession.duration_min,
          credits_required: selectedSession.credits_required,
          status: "pending",
          rescheduled_from_id: selectedSession.id,
        })
        .select();

      if (insertError) throw insertError;

      // Update original session as rescheduled
      const { error: updateError } = await supabase
        .from("Schedules")
        .update({
          status: "rescheduled",
          rescheduled_at: new Date().toISOString(),
        })
        .eq("id", selectedSession.id);

      if (updateError) throw updateError;

      alert("Session rescheduled successfully. Credits automatically adjusted.");
      setSessions(
        sessions.map((s) =>
          s.id === selectedSession.id ? { ...s, status: "rescheduled" } : s
        )
      );
      setSelectedSession(null);
      setActionType(null);
      setReschedulingData({ newDate: "", newTime: "" });
    } catch (error) {
      console.error("Error rescheduling session:", error);
      alert("Error rescheduling session. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Manage Sessions
          </h2>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Manage Sessions
        </h2>
        <p className="text-slate-500">
          Cancel or reschedule your upcoming sessions
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500">No upcoming sessions scheduled.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {session.subject}
                  </h3>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(session.start_time_utc).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {new Date(session.start_time_utc).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      - Duration: {session.duration_min} mins
                    </div>
                    <div className="mt-2">
                      Tutor:{" "}
                      {session.tutor
                        ? `${session.tutor.first_name || ""} ${
                            session.tutor.last_name || ""
                          }`.trim()
                        : "Unknown"}
                    </div>
                  </div>

                  {/* Policy info */}
                  <div className="mt-4 space-y-2">
                    {!canCancelSession(session) && (
                      <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          Cancellation deadline passed. Must cancel at least{" "}
                          {platformSettings.cancellation_notice_hours} hours in advance.
                        </span>
                      </div>
                    )}
                    {!canRescheduleSession(session) && (
                      <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          Rescheduling deadline passed. Must reschedule at least{" "}
                          {platformSettings.rescheduling_notice_hours} hours in advance.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  {canCancelSession(session) && (
                    <button
                      onClick={() => {
                        setSelectedSession(session);
                        setActionType("cancel");
                      }}
                      className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                    >
                      Cancel
                    </button>
                  )}
                  {canRescheduleSession(session) && (
                    <button
                      onClick={() => {
                        setSelectedSession(session);
                        setActionType("reschedule");
                      }}
                      className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                    >
                      Reschedule
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancellation Modal */}
      {actionType === "cancel" && selectedSession && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Cancel Session
              </h3>
              <button
                onClick={() => {
                  setActionType(null);
                  setSelectedSession(null);
                  setCancellationReason("");
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">
                  Session: {selectedSession.subject}
                </p>
                <p className="text-sm text-slate-600">
                  {new Date(selectedSession.start_time_utc).toLocaleDateString()} at{" "}
                  {new Date(selectedSession.start_time_utc).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-700">
                    <p className="font-medium">Full credit refund</p>
                    <p className="text-xs mt-1">
                      {selectedSession.credits_required} credits will be refunded
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please tell us why you're cancelling..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows="3"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setActionType(null);
                    setSelectedSession(null);
                    setCancellationReason("");
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition-colors"
                >
                  Keep Session
                </button>
                <button
                  onClick={handleCancellation}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {processing ? "Cancelling..." : "Cancel Session"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rescheduling Modal */}
      {actionType === "reschedule" && selectedSession && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-slate-900">
                Reschedule Session
              </h3>
              <button
                onClick={() => {
                  setActionType(null);
                  setSelectedSession(null);
                  setReschedulingData({ newDate: "", newTime: "" });
                  setAvailableDates([]);
                  setAvailableTimes([]);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">
                  Current Session: {selectedSession.subject}
                </p>
                <p className="text-sm text-slate-600">
                  {new Date(selectedSession.start_time_utc).toLocaleDateString()} at{" "}
                  {new Date(selectedSession.start_time_utc).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Select from tutor's available times only.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Select New Date
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {getAvailableDatesForReschedule(selectedSession.tutor).length === 0 ? (
                    <p className="text-sm text-slate-500 col-span-2">No available dates</p>
                  ) : (
                    getAvailableDatesForReschedule(selectedSession.tutor).map((date) => {
                      const dateObj = new Date(date);
                      const formattedDate = dateObj.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                      return (
                        <button
                          key={date}
                          onClick={() => {
                            setReschedulingData({ ...reschedulingData, newDate: date, newTime: "" });
                            setAvailableTimes(getAvailableTimesForReschedule(selectedSession.tutor, date));
                          }}
                          className={`p-2 rounded-lg border-2 transition-all text-sm ${
                            reschedulingData.newDate === date
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          {formattedDate}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {reschedulingData.newDate && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Select New Time
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {availableTimes.length === 0 ? (
                      <p className="text-sm text-slate-500 col-span-3">No available times</p>
                    ) : (
                      availableTimes.map((time) => (
                        <button
                          key={time}
                          onClick={() =>
                            setReschedulingData({ ...reschedulingData, newTime: time })
                          }
                          className={`p-2 rounded-lg border-2 transition-all text-sm ${
                            reschedulingData.newTime === time
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          {time}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setActionType(null);
                    setSelectedSession(null);
                    setReschedulingData({ newDate: "", newTime: "" });
                    setAvailableDates([]);
                    setAvailableTimes([]);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRescheduling}
                  disabled={processing || !reschedulingData.newDate || !reschedulingData.newTime}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {processing ? "Rescheduling..." : "Reschedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
