"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function PastSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(null);
  const [reviews, setReviews] = useState({});
  const [processing, setProcessing] = useState({});

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
            profile_name: session.profile_name,
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

  const handleSessionAction = async (id, action) => {
    setProcessing((prev) => ({ ...prev, [id]: true }));

    try {
      if (action === "successful") {
        setShowReview(id);
      } else {
        // Update session status in database using the new fields
        const newStatus =
          action === "student-no-show" ? "student-no-show" : "tutor-no-show";

        const { error } = await supabase
          .from("Schedules")
          .update({
            session_status: newStatus,
            session_action: action,
          })
          .eq("id", id);

        if (error) throw error;

        // Handle credit refunds based on action
        if (action === "tutor-no-show") {
          // Refund credits to student
          const session = sessions.find((s) => s.id === id);
          if (session) {
            const { data: studentData } = await supabase
              .from("Students")
              .select("credits")
              .eq("id", session.student_id)
              .single();

            if (studentData) {
              const newCredits =
                (studentData.credits || 0) + session.credits_required;
              await supabase
                .from("Students")
                .update({ credits: newCredits })
                .eq("id", session.student_id);
            }
          }
        }

        // Update local state
        setSessions(
          sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  status:
                    action === "student-no-show"
                      ? "student-no-show"
                      : "tutor-no-show",
                  action: action,
                }
              : session
          )
        );
      }
    } catch (error) {
      console.error("Error updating session:", error);
      alert("Error updating session. Please try again.");
    } finally {
      setProcessing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSubmitReview = async (id) => {
    if (!reviews[id]) {
      alert("Please write a review before submitting.");
      return;
    }

    setProcessing((prev) => ({ ...prev, [id]: true }));

    try {
      // Update session with review and mark as successful using the new fields
      const { error } = await supabase
        .from("Schedules")
        .update({
          session_status: "successful",
          session_action: "review-submitted",
          tutor_review: reviews[id],
        })
        .eq("id", id);

      if (error) throw error;

      // Award credits to tutor
      const session = sessions.find((s) => s.id === id);
      if (session) {
        const { data: tutorData } = await supabase
          .from("Tutors")
          .select("id")
          .eq("user_id", user.id)
          .single();

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Past Sessions
          </h2>
          <p className="text-slate-500">Review and manage completed sessions</p>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg p-6 shadow-sm border border-slate-200"
            >
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Past Sessions
        </h2>
        <p className="text-slate-500">Review and manage completed sessions</p>
      </div>

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No past sessions found.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-slate-900">
                    {session.student}
                  </p>
                  <p className="text-sm text-slate-500">
                    {session.subject} • {session.date}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{session.time}</p>
                  {session.profile_name && (
                    <p className="text-xs text-slate-500">
                      Profile: <span className="font-medium">{session.profile_name}</span>
                    </p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    session.status === "completed"
                      ? "bg-blue-100 text-blue-700"
                      : session.status === "successful"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {session.status === "completed"
                    ? "Pending Action"
                    : session.status === "successful"
                    ? "Successful"
                    : "No Show"}
                </span>
              </div>

              {showReview === session.id && session.status === "completed" && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Session Review (Required)
                  </label>
                  <textarea
                    placeholder="Write your review about this session..."
                    value={reviews[session.id] || ""}
                    onChange={(e) =>
                      setReviews({ ...reviews, [session.id]: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 h-24 placeholder:text-slate-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitReview(session.id)}
                      disabled={processing[session.id]}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {processing[session.id]
                        ? "Submitting..."
                        : "Submit Review"}
                    </button>
                    <button
                      onClick={() => setShowReview(null)}
                      className="px-4 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {session.status === "completed" && !showReview && (
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() =>
                      handleSessionAction(session.id, "successful")
                    }
                    disabled={processing[session.id]}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 transition-colors text-sm disabled:opacity-50"
                  >
                    Session Successful
                  </button>
                  <button
                    onClick={() =>
                      handleSessionAction(session.id, "student-no-show")
                    }
                    disabled={processing[session.id]}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors text-sm disabled:opacity-50"
                  >
                    Student Didn't Attend
                  </button>
                  <button
                    onClick={() =>
                      handleSessionAction(session.id, "tutor-no-show")
                    }
                    disabled={processing[session.id]}
                    className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors text-sm disabled:opacity-50"
                  >
                    I Didn't Attend
                  </button>
                </div>
              )}

              {session.status === "successful" && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">
                    Session marked as successful. Credits earned!
                  </p>
                  {session.review && (
                    <p className="text-xs text-green-600 mt-1">
                      Review: "{session.review}"
                    </p>
                  )}
                </div>
              )}

              {session.status === "student-no-show" && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 font-medium">
                    Student marked as no-show. Credits not refunded.
                  </p>
                </div>
              )}

              {session.status === "tutor-no-show" && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm text-orange-700 font-medium">
                    Marked as tutor no-show. Student refunded.
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
