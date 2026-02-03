"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { handleNoShow } from "@/lib/sessionPolicies";

export default function PastSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(null);
  const [reviews, setReviews] = useState({});
  const [processing, setProcessing] = useState({});
  const [showNoShowModal, setShowNoShowModal] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
              session.profile_name || session.student?.name || session.student?.email || "Student",
            subject: session.subject || "Tutoring Session",
            date: formatDate(session.start_time_utc),
            time: formatTime(session.start_time_utc, session.end_time_utc),
            status: session.session_status || "completed",
            action: session.session_action || null,
            credits_required: session.credits_required || 0,
            student_id: session.student_id,
            review: session.tutor_review || null,
            profile_name: session.profile_name,
            start_time_utc: session.start_time_utc,
            duration_min: session.duration_min,
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

  // Filter sessions by date range
  useEffect(() => {
    if (!allSessions.length) return;

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
      // First, check if credits were already awarded (check current session status from DB)
      const { data: currentSession, error: fetchError } = await supabase
        .from("Schedules")
        .select("session_status, credits_required, student_id, subject, start_time_utc, tutor_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Award credits only if session wasn't already marked as successful
      const shouldAwardCredits = currentSession.session_status !== "successful";
      
      if (shouldAwardCredits && currentSession.credits_required) {
        const { data: tutorData, error: tutorFetchError } = await supabase
          .from("Tutors")
          .select("id, credits")
          .eq("user_id", user.id)
          .single();

        if (tutorData && !tutorFetchError) {
          // Add credits to tutor
          const creditsEarned = parseFloat(currentSession.credits_required || 0);
          const currentCredits = parseFloat(tutorData.credits || 0);
          const newCredits = currentCredits + creditsEarned;

          const { error: updateCreditsError } = await supabase
            .from("Tutors")
            .update({ credits: newCredits })
            .eq("id", tutorData.id);

          if (updateCreditsError) {
            console.error("Error updating tutor credits:", updateCreditsError);
          } else {
            console.log(
              `Tutor earned ${creditsEarned} credits for session ${id}. New balance: ${newCredits}`
            );
          }
        }
      }

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

      // Send tutor review notification
      try {
        const { notifyTutorReview } = await import('@/lib/notificationService');
        const { getStudentEmailById } = await import('@/lib/notifications');
        
        // Get student info
        const { data: studentInfo } = await supabase
          .from("Students")
          .select("email, first_name, last_name")
          .eq("id", currentSession.student_id)
          .single();
        
        // Get tutor info
        const { data: tutorInfo } = await supabase
          .from("Tutors")
          .select("first_name, last_name")
          .eq("id", currentSession.tutor_id)
          .single();
        
        const studentEmail = studentInfo?.email || await getStudentEmailById(currentSession.student_id);
        const studentName = studentInfo ? `${studentInfo.first_name || ''} ${studentInfo.last_name || ''}`.trim() : 'Student';
        const tutorName = tutorInfo ? `${tutorInfo.first_name || ''} ${tutorInfo.last_name || ''}`.trim() : 'Tutor';
        
        // Format date for display
        const sessionDate = new Date(currentSession.start_time_utc).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        // Extract rating from review if it contains a rating (e.g., "5 stars" or just a number)
        // For now, default to 5 if not specified
        const reviewText = reviews[id] || '';
        const ratingMatch = reviewText.match(/\b([1-5])\b/);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5;
        
        if (studentEmail) {
          await notifyTutorReview(
            tutorName,
            studentEmail,
            studentName,
            sessionDate,
            currentSession.subject || 'General Session',
            rating,
            reviewText
          );
          console.log('Tutor review notification sent');
        }
      } catch (notifError) {
        console.error('Failed to send tutor review notification:', notifError);
        // Don't fail review submission if notification fails
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
        {allSessions.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            Showing {sessions.length} of {allSessions.length} sessions
          </p>
        )}
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
                    <span className="text-xs text-slate-400">•</span>
                    <p className="text-xs text-slate-500">
                      Credits: {session.credits_required} (₱{(session.credits_required * 180).toFixed(2)})
                    </p>
                    {session.profile_name && (
                      <>
                        <span className="text-xs text-slate-400">•</span>
                        <p className="text-xs text-slate-500">
                          Profile: <span className="font-medium">{session.profile_name}</span>
                        </p>
                      </>
                    )}
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
                  <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-medium text-green-900 mb-1">
                      You will earn: {session.credits_required} credits (₱{(session.credits_required * 90).toFixed(2)})
                    </p>
                    <p className="text-xs text-green-700">
                      {session.duration_min} minutes = {session.credits_required} credit{session.credits_required > 1 ? 's' : ''} (30 min = 1 credit, 1 hour = 2 credits)
                    </p>
                  </div>
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
                        : "Submit Review & Earn Credits"}
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
                  setShowNoShowModal(null);
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
