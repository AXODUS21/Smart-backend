"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PROFILE_ID, getActiveProfile } from "@/lib/studentProfiles";

export default function SessionManagement({ overrideStudentId }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState({
    min_booking_hours_advance: 2,
    cancellation_notice_hours: 24,
    rescheduling_notice_hours: 24,
  });
  const [studentRecord, setStudentRecord] = useState(null);
  const [isSchoolView, setIsSchoolView] = useState(false);
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
  const [sortBy, setSortBy] = useState("current"); // "current", "name", "scheduled_with"
  const [selectedTutorFilter, setSelectedTutorFilter] = useState("all"); // "all" or tutor ID

  // Fetch sessions and platform settings
  const fetchSessions = async () => {
    if (!user && !overrideStudentId) return;

    try {
      let studentData = null;
      let schoolId = null;
      let _isSchoolView = false;
      
      if (overrideStudentId) {
        // overrideStudentId might be a school ID when principal views as school
        // First check if it's a school - treat school as student entity
        const { data: schoolData } = await supabase
          .from("Schools")
          .select("id, name")
          .eq("id", overrideStudentId)
          .single();

        if (schoolData) {
          // Treat school as student - use school_id column for querying
          _isSchoolView = true;
          schoolId = schoolData.id;
        } else {
          // Not a school, try as student ID
          const { data, error } = await supabase
            .from("Students")
            .select("id, active_profile_id, extra_profiles")
            .eq("id", overrideStudentId)
            .single();
          studentData = data;
          if (error) {
            console.error("Error fetching student:", error);
            return;
          }
        }
      } else {
        const { data, error } = await supabase
          .from("Students")
          .select("id, active_profile_id, extra_profiles")
          .eq("user_id", user.id)
          .single();
        studentData = data;
        if (error) {
          console.error("Error fetching student:", error);
          return;
        }
      }

      if (!studentData && !schoolId) {
        console.log("No student or school data found");
        return;
      }

      // Build the query based on whether it's a school or student view
      let query = supabase
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
        );
      
      // Filter by school_id or student_id
      if (_isSchoolView) {
        query = query.eq("school_id", schoolId);
      } else {
        query = query.eq("student_id", studentData.id);
      }
      
      setIsSchoolView(_isSchoolView);
      if (studentData) setStudentRecord(studentData);
      
      // Fetch upcoming sessions (confirmed and pending that can be managed)
      const { data: sessionsData, error: sessionsError } = await query
        .in("status", ["confirmed", "pending"])
        .gt("start_time_utc", new Date().toISOString())
        .order("start_time_utc", { ascending: true });

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);
      } else {
        // Filter by active profile
        const activeProfileId = studentData?.active_profile_id;
        const profileIdFilter = _isSchoolView
          ? null
          : activeProfileId || DEFAULT_PROFILE_ID;
        
        const filteredSessions = _isSchoolView
          ? (sessionsData || [])
          : (sessionsData || []).filter((session) => {
              if (!session.profile_id) {
                return profileIdFilter === DEFAULT_PROFILE_ID;
              }
              return session.profile_id === profileIdFilter;
            });

        console.log("Fetched sessions:", filteredSessions);
        setSessions(filteredSessions);
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

  useEffect(() => {
    setLoading(true);
    fetchSessions();
  }, [user, overrideStudentId]);

  // Check if cancellation is allowed
  const canCancelSession = (session) => {
    const now = new Date();
    const sessionStart = new Date(session.start_time_utc);
    
    // Cannot cancel past sessions
    if (now >= sessionStart) return false;

    const hoursUntilSession = (sessionStart - now) / (1000 * 60 * 60);
    const requiredHours = platformSettings.cancellation_notice_hours || 24;
    return hoursUntilSession >= requiredHours;
  };

  // Check if rescheduling is allowed
  const canRescheduleSession = (session) => {
    const now = new Date();
    const sessionStart = new Date(session.start_time_utc);
    
    // Cannot reschedule past sessions
    if (now >= sessionStart) return false;

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

    const hoursUntilSession = getHoursUntilSession(selectedSession);
    const requiredHours = platformSettings.cancellation_notice_hours || 24;
    console.log("Cancellation check - Hours until session:", hoursUntilSession, "Required hours:", requiredHours);
    
    if (!canCancelSession(selectedSession)) {
      if (new Date(selectedSession.start_time_utc) <= new Date()) {
        alert("Cannot cancel a past session.");
      } else {
        alert(
          `Cancellations must be made at least ${requiredHours} hours in advance. Your session is in ${hoursUntilSession} hours.`
        );
      }
      return;
    }

    setProcessing(true);
    try {
      console.log("Starting cancellation for session:", selectedSession.id);
      
      // Update session with cancellation info
      const { data: updateData, error: updateError } = await supabase
        .from("Schedules")
        .update({
          status: "cancelled",
          cancellation_requested_at: new Date().toISOString(),
          cancellation_reason: cancellationReason,
          cancellation_status: "approved",
          credits_refunded: selectedSession.credits_required,
          cancelled_by_role: "student",
        })
        .eq("id", selectedSession.id)
        .select();

      if (updateError) {
        console.error("Error updating session status:", updateError);
        throw updateError;
      }
      
      console.log("Session cancelled in database:", updateData);

      // Refund credits to Principal or Student
      const amount = selectedSession.credits_required || 0;
      if (selectedSession.principal_user_id) {
        const { data: principalData, error: principalError } = await supabase
          .from("Principals")
          .select("credits")
          .eq("user_id", selectedSession.principal_user_id)
          .single();
        if (principalError) {
          console.error("Error fetching principal:", principalError);
          throw principalError;
        }
        if (principalData) {
          const newCredits = (principalData.credits || 0) + amount;
          const { error: creditError } = await supabase
            .from("Principals")
            .update({ credits: newCredits })
            .eq("user_id", selectedSession.principal_user_id);
          if (creditError) throw creditError;
          console.log("Credits refunded to principal. New balance:", newCredits);
        }
      } else {
        const { data: studentData, error: studentError } = await supabase
          .from("Students")
          .select("credits, id")
          .eq("id", selectedSession.student_id)
          .single();
        if (studentError) {
          console.error("Error fetching student:", studentError);
          throw studentError;
        }
        if (studentData) {
          const newCredits = (studentData.credits || 0) + amount;
          const { error: creditError } = await supabase
            .from("Students")
            .update({ credits: newCredits })
            .eq("id", studentData.id);
          if (creditError) throw creditError;
          console.log("Credits refunded. New balance:", newCredits);
        }
      }

      // Send session cancellation notification
      try {
        const { notifySessionBooking } = await import('@/lib/notificationService');
        const { getTutorEmailById, getStudentEmailById } = await import('@/lib/notifications');
        
        // Get tutor and student info
        const tutorEmail = await getTutorEmailById(selectedSession.tutor_id);
        const studentEmail = await getStudentEmailById(selectedSession.student_id);
        
        // Get tutor and student names
        const { data: tutorInfo } = await supabase
          .from("Tutors")
          .select("first_name, last_name")
          .eq("id", selectedSession.tutor_id)
          .single();
        
        const studentName = studentData?.name || `${studentData?.first_name || ''} ${studentData?.last_name || ''}`.trim() || 'Student';
        const tutorName = tutorInfo ? `${tutorInfo.first_name || ''} ${tutorInfo.last_name || ''}`.trim() : 'Tutor';
        
        // Format date and time for display
        const sessionDate = new Date(selectedSession.start_time_utc).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const sessionTime = new Date(selectedSession.start_time_utc).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
        
        if (tutorEmail && studentEmail) {
          await notifySessionBooking(
            studentEmail,
            studentName,
            tutorEmail,
            tutorName,
            sessionDate,
            sessionTime,
            selectedSession.subject || 'General Session',
            'cancelled'
          );
          console.log('Session cancellation notification sent');
        }
      } catch (notifError) {
        console.error('Failed to send session cancellation notification:', notifError);
        // Don't fail cancellation if notification fails
      }

      alert("Session cancelled successfully. Credits have been refunded.");
      
      // Remove from local state immediately
      const updatedSessions = sessions.filter(s => s.id !== selectedSession.id);
      console.log("Updated sessions list:", updatedSessions);
      setSessions(updatedSessions);
      
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
      if (new Date(selectedSession.start_time_utc) <= new Date()) {
        alert("Cannot reschedule a past session.");
      } else {
        const hoursUntilSession = getHoursUntilSession(selectedSession);
        alert(
          `Rescheduling must be done at least ${platformSettings.rescheduling_notice_hours} hours in advance. Your session is in ${hoursUntilSession} hours.`
        );
      }
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
      // Parse new time - handle AM/PM conversion correctly
      const [time, period] = reschedulingData.newTime.split(" ");
      const [hours, minutes] = time.split(":");
      let hour24 = parseInt(hours);
      
      // Correct AM/PM to 24-hour conversion
      if (period === "PM" && hour24 !== 12) {
        hour24 += 12;
      } else if (period === "AM" && hour24 === 12) {
        hour24 = 0;
      }

      // Parse date string (YYYY-MM-DD format from input)
      const [year, month, day] = reschedulingData.newDate.split("-");
      
      // Create a UTC date directly with the selected date and time
      const newStartTimeUTC = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed
        parseInt(day),
        hour24,
        parseInt(minutes),
        0,
        0
      ));

      const newEndTime = new Date(newStartTimeUTC);
      newEndTime.setMinutes(newEndTime.getMinutes() + selectedSession.duration_min);

      // Create new session with correct UTC times - status should be pending so tutor can accept
      const insertPayload = {
        student_id: selectedSession.student_id,
        tutor_id: selectedSession.tutor_id,
        subject: selectedSession.subject,
        start_time_utc: newStartTimeUTC.toISOString(),
        end_time_utc: newEndTime.toISOString(),
        duration_min: selectedSession.duration_min,
        credits_required: selectedSession.credits_required,
        status: "pending",
        rescheduled_from_id: selectedSession.id,
      };
      if (selectedSession.principal_user_id) insertPayload.principal_user_id = selectedSession.principal_user_id;

      const { data: newSession, error: insertError } = await supabase
        .from("Schedules")
        .insert(insertPayload)
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

      alert("Session rescheduled successfully. A new booking request has been sent to the tutor.");
      
      // Remove old session from local state (it's now marked as rescheduled)
      // The new session is pending, so it won't show in Manage Sessions until tutor accepts it
      const updatedSessions = sessions.filter(s => s.id !== selectedSession.id);
      setSessions(updatedSessions);
      
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
        {/* Profile Indicator */}
        {studentRecord && !isSchoolView && (() => {
          const ap = getActiveProfile(studentRecord);
          if (ap) {
            return (
              <p className="text-sm text-blue-600 font-medium mb-1">
                Viewing for profile: {ap.name}
              </p>
            );
          }
          return null;
        })()}
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
          {/* Filtering Controls */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Filter by Tutor
                </label>
                <select
                  value={selectedTutorFilter}
                  onChange={(e) => setSelectedTutorFilter(e.target.value)}
                  className="w-full md:w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Tutors</option>
                  {(() => {
                    const tutorMap = new Map();
                    sessions
                      .filter((s) => s.tutor && s.tutor_id)
                      .forEach((s) => {
                        if (!tutorMap.has(s.tutor_id)) {
                          const tutorName = `${s.tutor.first_name || ""} ${
                            s.tutor.last_name || ""
                          }`.trim() || "Unknown";
                          tutorMap.set(s.tutor_id, tutorName);
                        }
                      });
                    return Array.from(tutorMap.entries())
                      .sort((a, b) => a[1].localeCompare(b[1]))
                      .map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ));
                  })()}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full md:w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="current">Current Status (Default)</option>
                  <option value="name">By Tutor Name</option>
                  <option value="scheduled_with">By Scheduled Date/Time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filtered and Sorted Sessions */}
          {(() => {
            // Filter by tutor
            let filteredSessions = sessions;
            if (selectedTutorFilter !== "all") {
              const filterTutorId = parseInt(selectedTutorFilter);
              filteredSessions = sessions.filter(
                (s) => s.tutor_id === filterTutorId
              );
            }

            // Sort sessions
            let sortedSessions = [...filteredSessions];
            if (sortBy === "name") {
              sortedSessions.sort((a, b) => {
                const tutorA = a.tutor
                  ? `${a.tutor.first_name || ""} ${a.tutor.last_name || ""}`.trim() ||
                    "Unknown"
                  : "Unknown";
                const tutorB = b.tutor
                  ? `${b.tutor.first_name || ""} ${b.tutor.last_name || ""}`.trim() ||
                    "Unknown"
                  : "Unknown";
                return tutorA.localeCompare(tutorB);
              });
            } else if (sortBy === "scheduled_with") {
              // Sort by scheduled date/time (earliest first)
              sortedSessions.sort((a, b) => {
                return new Date(a.start_time_utc) - new Date(b.start_time_utc);
              });
            } else {
              // Default: current status - pending first, then confirmed, sorted by time
              sortedSessions.sort((a, b) => {
                if (a.status !== b.status) {
                  return a.status === "pending" ? -1 : 1;
                }
                return (
                  new Date(a.start_time_utc) - new Date(b.start_time_utc)
                );
              });
            }

            return sortedSessions.length === 0 ? (
              <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-200 text-center">
                <p className="text-slate-500">No sessions match your filters.</p>
              </div>
            ) : (
              sortedSessions.map((session) => (
            <div
              key={session.id}
              className={`rounded-lg p-6 shadow-sm border ${
                session.status === "pending"
                  ? "bg-slate-50 border-slate-200 opacity-60"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {session.subject}
                    </h3>
                    {session.status === "pending" && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                        Awaiting Tutor Acceptance
                      </span>
                    )}
                  </div>
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
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                          Cancellation deadline passed. Must cancel at least{" "}
                          {platformSettings.cancellation_notice_hours} hours in advance.
                        </span>
                      </div>
                    )}
                    {!canRescheduleSession(session) && (
                      <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
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
              ))
            );
          })()}
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
                  <CheckCircle className="w-4 h-4 text-green-700 mt-0.5 shrink-0" />
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
