"use client";

import { useState, useEffect } from "react";
import { AlertCircle, X, MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { handleNoShow } from "@/lib/sessionPolicies";
import { DEFAULT_PROFILE_ID, getActiveProfile } from "@/lib/studentProfiles";

export default function StudentPastSessions({ overrideStudentId }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [showNoShowModal, setShowNoShowModal] = useState(null);
  const [reportModal, setReportModal] = useState({ isOpen: false, sessionId: null });
  const [reportMessage, setReportMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);

  // Fetch past sessions for the student
  useEffect(() => {
    const fetchPastSessions = async () => {
      if (!user && !overrideStudentId) return;

      try {
        let studentId = null;
        let schoolId = null;
        let isSchoolView = false;
        let activeProfileId = null;
        
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
            isSchoolView = true;
            schoolId = schoolData.id;
            setStudentRecord({ id: schoolData.id, isSchool: true });
          } else {
            // Fallback: use as student ID
            const { data: stData } = await supabase
              .from("Students")
              .select("id, first_name, last_name, extra_profiles, active_profile_id")
              .eq("id", overrideStudentId)
              .single();
            if (stData) {
              studentId = stData.id;
              activeProfileId = stData.active_profile_id;
              setStudentRecord(stData);
            } else {
              studentId = overrideStudentId;
            }
          }
        } else {
          const { data: studentData } = await supabase
            .from("Students")
            .select("id, first_name, last_name, extra_profiles, active_profile_id")
            .eq("user_id", user.id)
            .single();
          studentId = studentData?.id;
          activeProfileId = studentData?.active_profile_id;
          if (studentData) setStudentRecord(studentData);
        }

        if (!studentId && !schoolId) return;

        // Build the query based on whether it's a school or student view
        let query = supabase
          .from("Schedules")
          .select(
            `
            *,
            tutor:tutor_id (
              name,
              email,
              first_name,
              last_name
            )
          `
          );
        
        // Filter by school_id or student_id
        if (isSchoolView) {
          query = query.eq("school_id", schoolId);
        } else {
          query = query.eq("student_id", studentId);
        }
        
        // Fetch past sessions that are confirmed
        const { data, error } = await query
          .in("status", ["confirmed", "successful", "pending"])
          .lt("end_time_utc", new Date().toISOString())
          .order("start_time_utc", { ascending: false });

        if (error) {
          console.error("Error fetching past sessions:", error);
        } else {
          // Filter by active profile
          const profileIdFilter = isSchoolView
            ? null
            : activeProfileId || DEFAULT_PROFILE_ID;

          const profileFiltered = isSchoolView
            ? (data || [])
            : (data || []).filter((session) => {
                if (!session.profile_id) {
                  return profileIdFilter === DEFAULT_PROFILE_ID;
                }
                return session.profile_id === profileIdFilter;
              });

          const transformedSessions = profileFiltered.map((session) => ({
            id: session.id,
            tutor:
              session.tutor?.name ||
              `${session.tutor?.first_name || ""} ${session.tutor?.last_name || ""}`.trim() ||
              session.tutor?.email ||
              "Tutor",
            subject: session.subject || "Tutoring Session",
            date: formatDate(session.start_time_utc),
            time: formatTime(session.start_time_utc, session.end_time_utc),
            status: session.session_status || "completed",
            action: session.session_action || null,
            credits_required: session.credits_required || 0,
            tutor_id: session.tutor_id,
            start_time_utc: session.start_time_utc,
            duration_min: session.duration_min,
            no_show_type: session.no_show_type,
          }));
          setAllSessions(transformedSessions);
          setSessions(transformedSessions);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPastSessions();
  }, [user, overrideStudentId]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { month: "short", day: "numeric", year: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const formatTime = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const startStr = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const endStr = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${startStr} - ${endStr}`;
  };

  // Filter sessions by date range
  useEffect(() => {
    let filtered = allSessions;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = allSessions.filter((s) => {
        const sessionDate = new Date(s.start_time_utc);
        return sessionDate >= start && sessionDate <= end;
      });
    }
    setSessions(filtered);
  }, [startDate, endDate, allSessions]);

  const handleMarkTutorNoShow = async (sessionId) => {
    setProcessing((prev) => ({ ...prev, [sessionId]: true }));
    setShowNoShowModal(null);

    try {
      const result = await handleNoShow(sessionId, "tutor-no-show");
      
      if (result && result.isConflict) {
        alert(result.message);
        // Refresh session to show updated status
        const { data } = await supabase
          .from("Schedules")
          .select(
            `
            *,
            tutor:tutor_id (
              name,
              email,
              first_name,
              last_name
            )
          `
          )
          .eq("id", sessionId)
          .single();
          
        if (data) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    status: data.session_status || "completed",
                    action: data.session_action || null,
                  }
                : s
            )
          );
        }
        return;
      }

      alert("Tutor no-show recorded. Credits have been refunded to your account.");
      
      // Refresh sessions
      const { data } = await supabase
        .from("Schedules")
        .select(
          `
          *,
          tutor:tutor_id (
            name,
            email,
            first_name,
            last_name
          )
        `
        )
        .eq("id", sessionId)
        .single();
      
      if (data) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  status: "tutor-no-show",
                  action: "tutor-no-show",
                  no_show_type: "tutor-no-show",
                }
              : s
          )
        );
      }
    } catch (error) {
      console.error("Error marking tutor no-show:", error);
      alert("Error marking tutor no-show. Please try again.");
    } finally {
      setProcessing((prev) => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleReportIssue = async () => {
    if (!reportMessage.trim()) {
      alert("Please enter a description of the issue.");
      return;
    }

    const sessionId = reportModal.sessionId;
    setProcessing((prev) => ({ ...prev, [sessionId]: true }));

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) throw new Error("Session not found");

      // Get student details
      const { data: studentData } = await supabase
        .from("Students")
        .select("name, email")
        .eq("user_id", user.id)
        .single();

      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "session_issue",
          recipients: ["admin@smartbrainlearning.org"],
          data: {
            studentName: studentData?.name || user.email,
            studentEmail: studentData?.email || user.email,
            tutorName: session.tutor,
            sessionId: session.id,
            sessionDate: session.date,
            issueType: "Conflict: Tutor marked successful, Student reported issue",
            description: reportMessage
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to send report");

      alert("Your issue has been reported. Support will review it shortly.");
      setReportModal({ isOpen: false, sessionId: null });
      setReportMessage("");
    } catch (error) {
      console.error("Error reporting issue:", error);
      alert("Failed to report issue. Please try again or email admin@smartbrainlearning.org directly.");
    } finally {
      setProcessing((prev) => ({ ...prev, [sessionId]: false }));
    }
  };

  // Use sessions directly (already filtered by useEffect)
  const filteredSessions = sessions;

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">
            Past Sessions
          </h2>
          <p className="text-sm text-slate-500">
            Review your completed sessions
          </p>
        </div>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg p-3 shadow-sm border border-slate-200"
            >
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-1"></div>
              <div className="h-2 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-1">
          Past Sessions
        </h2>
        <p className="text-sm text-slate-500">
          Review your completed sessions and mark tutors as no-show if they didn't attend
        </p>
        {studentRecord && !studentRecord.isSchool && (() => {
          const ap = getActiveProfile(studentRecord);
          return ap ? (
            <p className="text-xs text-slate-500 mt-1">
              Showing sessions for <span className="font-medium">{ap.name}</span>. Switch profiles in Student Settings.
            </p>
          ) : null;
        })()}
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Filter by Date Range</h3>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          {(startDate || endDate) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        {startDate && endDate && (
          <p className="text-xs text-slate-500 mt-2">
            Showing sessions from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No past sessions found.</p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg p-3 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">
                      {session.tutor}
                    </p>
                    <span className="text-xs text-slate-400">•</span>
                    <p className="text-xs text-slate-500">{session.subject}</p>
                    <span className="text-xs text-slate-400">•</span>
                    <p className="text-xs text-slate-500">{session.date}</p>
                    <span className="text-xs text-slate-400">•</span>
                    <p className="text-xs text-slate-500">{session.time}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                    session.status === "completed" || session.status === "successful"
                      ? "bg-green-100 text-green-700"
                      : session.no_show_type === "tutor-no-show"
                      ? "bg-red-100 text-red-700"
                      : session.status === "pending"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {session.no_show_type === "tutor-no-show"
                    ? "Tutor No-Show"
                    : session.status === "successful"
                    ? "Successful"
                    : session.status === "completed"
                    ? "Completed (Pending)"
                    : session.status === "pending"
                    ? "Expired"
                    : "Pending"}
                </span>
              </div>

              {/* Actions based on session status */}
              {/* If successful, show Report Issue (conflict prevention) */}
              {session.status === "successful" && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setReportModal({ isOpen: true, sessionId: session.id })}
                    className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Report Issue
                  </button>
                  <p className="text-xs text-slate-500 mt-1">
                    The tutor has marked this session as successful. Contact support if this is incorrect.
                  </p>
                </div>
              )}

              {/* No-show button - only show if session is completed (but not successful) and no no-show has been marked */}
              {!session.no_show_type && session.status === "completed" && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => setShowNoShowModal(session.id)}
                      disabled={processing[session.id]}
                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {processing[session.id]
                        ? "Processing..."
                        : "Mark Tutor as No-Show"}
                    </button>
                    <p className="text-xs text-slate-500 mt-1">
                      If the tutor didn't attend this session, mark them as no-show to get your credits refunded.
                    </p>
                  </div>
                )}
            </div>
          ))
        )}
      </div>

      {/* No-Show Confirmation Modal */}
      {showNoShowModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Mark Tutor as No-Show
              </h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-700 mb-4">
                Are you sure the tutor did not attend this session? Marking them as no-show will refund your credits.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMarkTutorNoShow(showNoShowModal)}
                  disabled={processing[showNoShowModal]}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {processing[showNoShowModal] ? "Processing..." : "Yes, Mark No-Show"}
                </button>
                <button
                  onClick={() => setShowNoShowModal(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Report Issue
              </h3>
              <button 
                onClick={() => setReportModal({ isOpen: false, sessionId: null })}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                You are reporting an issue for a session marked as "Successful" by the tutor. Please describe why you are disputing this session.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description of Issue
                </label>
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  placeholder="e.g. The tutor did not show up, or the session was cut short..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm h-32 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setReportModal({ isOpen: false, sessionId: null })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportIssue}
                  disabled={processing[reportModal.sessionId] || !reportMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  {processing[reportModal.sessionId] ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
