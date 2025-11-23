"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { handleNoShow } from "@/lib/sessionPolicies";
import { notifyTutorReview } from "@/lib/notifications";

export default function PastSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(null);
  const [reviews, setReviews] = useState({});
  const [processing, setProcessing] = useState({});
  const [showNoShowModal, setShowNoShowModal] = useState(null);
  const [noShowType, setNoShowType] = useState(null);

  // Fetch past sessions for the tutor
  useEffect(() => {
    const fetchPastSessions = async () => {
      if (!user) return;

      try {
        // Get tutor ID first
        const { data: tutorData } = await supabase
          .from("Tutors")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!tutorData) return;

        // Fetch sessions that have ended (past sessions) and are confirmed
        const { data, error } = await supabase
          .from("Schedules")
          .select(
            `
            *,
            student:student_id (
              name,
              email
            )
          `
          )
          .eq("tutor_id", tutorData.id)
          .eq("status", "confirmed")
          .lt("end_time_utc", new Date().toISOString())
          .order("start_time_utc", { ascending: false });

        if (error) {
          console.error("Error fetching past sessions:", error);
        } else {
          // Transform data to match component structure
          const transformedSessions = (data || []).map((session) => ({
            id: session.id,
            student:
              session.student?.name || session.student?.email || "Student",
            subject: session.subject || "Tutoring Session",
            date: formatDate(session.start_time_utc),
            time: formatTime(session.start_time_utc, session.end_time_utc),
            status: session.session_status || "completed",
            action: session.session_action || null,
            credits_required: session.credits_required || 0,
            student_id: session.student_id,
            review: session.tutor_review || null,
          }));
          setSessions(transformedSessions);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPastSessions();
  }, [user]);

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

  const handleWriteReview = async (id) => {
    setShowReview(id);
  };

  const handleSubmitReview = async (id) => {
    if (!reviews[id]) {
      alert("Please write a review before submitting.");
      return;
    }

    setProcessing((prev) => ({ ...prev, [id]: true }));

    try {
      // Update session with review and mark as successful using the new database fields
      const { error } = await supabase
        .from("Schedules")
        .update({
          session_status: "successful",
          session_action: "review-submitted",
          tutor_review: reviews[id],
          status: "confirmed", // Keep the main status as confirmed so session remains visible
        })
        .eq("id", id);

      if (error) throw error;

      // Get session and student information for notification
      const session = sessions.find((s) => s.id === id);
      if (session) {
        const { data: tutorData } = await supabase
          .from("Tutors")
          .select("first_name, last_name, email")
          .eq("user_id", user.id)
          .single();

        const { data: studentData } = await supabase
          .from("Students")
          .select("first_name, last_name, email")
          .eq("id", session.student_id)
          .single();

        // Send notification to student
        try {
          const studentName = `${studentData?.first_name || ''} ${studentData?.last_name || ''}`.trim() || studentData?.email || 'Student';
          const tutorName = `${tutorData?.first_name || ''} ${tutorData?.last_name || ''}`.trim() || tutorData?.email || 'Tutor';
          const sessionDate = new Date(session.start_time_utc).toLocaleDateString();
          
          await notifyTutorReview({
            studentEmail: studentData?.email || '',
            studentName: studentName,
            tutorName: tutorName,
            subject: session.subject || 'Tutoring Session',
            sessionDate: sessionDate,
            review: reviews[id],
          });
        } catch (notificationError) {
          console.error('Failed to send tutor review notification:', notificationError);
        }

        if (tutorData) {
          // You might want to add a credits_earned field to Tutors table
          // For now, we'll just update the session status
          console.log(
            `Tutor earned ${session.credits_required} credits for session ${id}`
          );
        }
      }

      // Update local state
      setSessions(
        sessions.map((session) =>
          session.id === id
            ? {
                ...session,
                status: "successful",
                action: "review-submitted",
                review: reviews[id],
              }
            : session
        )
      );

      setShowReview(null);
      setReviews((prev) => ({ ...prev, [id]: "" }));
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Error submitting review. Please try again.");
    } finally {
      setProcessing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleMarkNoShow = async (id, type) => {
    setProcessing((prev) => ({ ...prev, [id]: true }));

    try {
      await handleNoShow(id, type);

      // Update local state
      setSessions(
        sessions.map((session) =>
          session.id === id
            ? {
                ...session,
                status: type === "student-no-show" ? "student-no-show" : "tutor-no-show",
                action: type,
              }
            : session
        )
      );

      setShowNoShowModal(null);
      setNoShowType(null);
      alert(
        type === "student-no-show"
          ? "Student no-show recorded. Credits forfeited."
          : "Tutor no-show recorded. Credits refunded to student."
      );
    } catch (error) {
      console.error("Error marking no-show:", error);
      alert("Error marking no-show. Please try again.");
    } finally {
      setProcessing((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">
            Past Sessions
          </h2>
          <p className="text-sm text-slate-500">
            Review and manage completed sessions
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
          Review and manage completed sessions
        </p>
      </div>

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No past sessions found.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg p-3 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">
                      {session.student}
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
                    session.status === "completed"
                      ? "bg-blue-100 text-blue-700"
                      : session.status === "successful"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {session.status === "completed"
                    ? "Pending"
                    : session.status === "successful"
                    ? "Successful"
                    : "No Show"}
                </span>
              </div>

              {showReview === session.id && session.status === "completed" && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="block text-xs font-medium text-slate-900 mb-1.5">
                    Session Review (Required)
                  </label>
                  <textarea
                    placeholder="Write your review about this session..."
                    value={reviews[session.id] || ""}
                    onChange={(e) =>
                      setReviews({ ...reviews, [session.id]: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 h-20 placeholder:text-slate-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitReview(session.id)}
                      disabled={processing[session.id]}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {processing[session.id]
                        ? "Submitting..."
                        : "Submit Review"}
                    </button>
                    <button
                      onClick={() => setShowReview(null)}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {session.status === "completed" && !showReview && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleWriteReview(session.id)}
                    disabled={processing[session.id]}
                    className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    Write a Review
                  </button>
                  <button
                    onClick={() => setShowNoShowModal(session.id)}
                    disabled={processing[session.id]}
                    className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    Mark No-Show
                  </button>
                </div>
              )}

              {session.status === "successful" && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-700 font-medium">
                    Session marked as successful. Credits earned!
                  </p>
                  {session.review && (
                    <p className="text-xs text-green-600 mt-1">
                      Review: "{session.review}"
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* No-Show Modal */}
      {showNoShowModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Mark Session as No-Show
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Select who did not show up for this session
              </p>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setNoShowType("student-no-show");
                  handleMarkNoShow(showNoShowModal, "student-no-show");
                }}
                disabled={processing[showNoShowModal]}
                className="w-full p-4 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">Student No-Show</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Student did not attend the session. Credits will be forfeited.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setNoShowType("tutor-no-show");
                  handleMarkNoShow(showNoShowModal, "tutor-no-show");
                }}
                disabled={processing[showNoShowModal]}
                className="w-full p-4 border-2 border-amber-200 rounded-lg hover:bg-amber-50 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">Tutor No-Show</p>
                    <p className="text-sm text-slate-600 mt-1">
                      You did not attend the session. Credits will be refunded to student.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowNoShowModal(null);
                  setNoShowType(null);
                }}
                disabled={processing[showNoShowModal]}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
