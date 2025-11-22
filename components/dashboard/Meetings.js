"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Video,
  Calendar,
  Clock,
  BookOpen,
  Check,
  X,
  User,
  Link,
} from "lucide-react";

export default function Meetings() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [tutorBookings, setTutorBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [meetingLinkModal, setMeetingLinkModal] = useState({
    isOpen: false,
    bookingId: null,
  });
  const [meetingLink, setMeetingLink] = useState("");

  const [view, setView] = useState("upcoming");
  const [tutorView, setTutorView] = useState("pending");

  // Determine user role
  useEffect(() => {
    const determineRole = async () => {
      if (!user) return;

      try {
        // Check if user is a student
        const { data: studentData } = await supabase
          .from("Students")
          .select("user_id")
          .eq("user_id", user.id)
          .single();

        if (studentData) {
          setUserRole("student");
        } else {
          setUserRole("tutor");
        }
      } catch (error) {
        console.error("Error determining role:", error);
      } finally {
        setLoading(false);
      }
    };

    determineRole();
  }, [user]);

  // Fetch scheduled meetings for students
  useEffect(() => {
    const fetchMeetings = async () => {
      if (!user || userRole !== "student") return;

      try {
        // Get student ID first
        const { data: studentData } = await supabase
          .from("Students")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!studentData) return;

        const { data, error } = await supabase
          .from("Schedules")
          .select(
            `
            *,
            tutor:tutor_id (
              name,
              email
            )
          `
          )
          .eq("student_id", studentData.id)
          .order("start_time_utc", { ascending: true });

        if (error) {
          console.error("Error fetching meetings:", error);
        } else {
          setScheduledMeetings(data || []);
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchMeetings();
  }, [user, userRole]);

  // Helper function to check if a booking's start time is in the past
  const isPastBooking = (startTimeUtc) => {
    if (!startTimeUtc) return false;
    const now = new Date();
    const bookingStart = new Date(startTimeUtc);
    return bookingStart < now;
  };

  // Automatically reject/cancel past pending bookings
  const handlePastPendingBookings = async (bookings) => {
    const now = new Date();
    const pastPendingBookings = bookings.filter(
      (booking) =>
        booking.status === "pending" && isPastBooking(booking.start_time_utc)
    );

    if (pastPendingBookings.length === 0) return bookings;

    // Process each past pending booking
    for (const booking of pastPendingBookings) {
      try {
        // Get the booking details first
        const { data: bookingData } = await supabase
          .from("Schedules")
          .select("student_id, credits_required")
          .eq("id", booking.id)
          .single();

        if (bookingData && bookingData.student_id) {
          // Try to refund credits to student
          try {
            const { data: studentData } = await supabase
              .from("Students")
              .select("credits")
              .eq("id", bookingData.student_id)
              .single();

            if (studentData) {
              const newCredits =
                (studentData.credits || 0) + (bookingData.credits_required || 0);

              await supabase
                .from("Students")
                .update({ credits: newCredits })
                .eq("id", bookingData.student_id);
            }
          } catch (creditError) {
            console.warn("Error refunding credits for past booking:", creditError);
          }

          // Update booking status to rejected (past bookings are automatically rejected)
          await supabase
            .from("Schedules")
            .update({ status: "rejected" })
            .eq("id", booking.id);
        }
      } catch (error) {
        console.error("Error processing past booking:", error);
      }
    }

    // Return updated bookings list
    return bookings.map((booking) => {
      if (
        booking.status === "pending" &&
        isPastBooking(booking.start_time_utc)
      ) {
        return { ...booking, status: "rejected" };
      }
      return booking;
    });
  };

  // Fetch bookings for tutors
  useEffect(() => {
    const fetchTutorBookings = async () => {
      if (!user || userRole !== "tutor") return;

      try {
        // Get tutor ID first
        const { data: tutorData } = await supabase
          .from("Tutors")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!tutorData) return;

        // Fetch ALL bookings (pending, confirmed, rejected, cancelled)
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
          .in("status", ["pending", "confirmed", "rejected", "cancelled"])
          .order("start_time_utc", { ascending: true });

        if (error) {
          console.error("Error fetching tutor bookings:", error);
        } else {
          // Automatically handle past pending bookings
          const processedBookings = await handlePastPendingBookings(data || []);
          setTutorBookings(processedBookings);
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchTutorBookings();
  }, [user, userRole]);

  // Handle opening meeting link modal
  const handleAcceptBooking = (bookingId) => {
    setMeetingLinkModal({ isOpen: true, bookingId });
    setMeetingLink("");
  };

  // Handle confirming booking with meeting link
  const handleConfirmBookingWithLink = async () => {
    if (!meetingLink.trim()) {
      alert("Please enter a meeting link before accepting the booking.");
      return;
    }

    const bookingId = meetingLinkModal.bookingId;
    setProcessing((prev) => ({ ...prev, [bookingId]: "accepting" }));

    try {
      const { error } = await supabase
        .from("Schedules")
        .update({
          status: "confirmed",
          meeting_link: meetingLink.trim(),
        })
        .eq("id", bookingId);

      if (error) throw error;

      // Close modal
      setMeetingLinkModal({ isOpen: false, bookingId: null });
      setMeetingLink("");

      // Refresh bookings
      const { data: tutorData } = await supabase
        .from("Tutors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (tutorData) {
        const { data } = await supabase
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
          .in("status", ["pending", "confirmed", "rejected", "cancelled"])
          .order("start_time_utc", { ascending: true });

        setTutorBookings(data || []);
      }
    } catch (error) {
      console.error("Error accepting booking:", error);
      alert("Error accepting booking. Please try again.");
    } finally {
      setProcessing((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  // Handle closing meeting link modal
  const handleCloseMeetingLinkModal = () => {
    setMeetingLinkModal({ isOpen: false, bookingId: null });
    setMeetingLink("");
  };

  // Handle rejecting a booking
  const handleRejectBooking = async (bookingId, creditsRequired) => {
    setProcessing((prev) => ({ ...prev, [bookingId]: "rejecting" }));

    try {
      // Get the booking details first
      const { data: bookingData, error: bookingError } = await supabase
        .from("Schedules")
        .select("student_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError) {
        console.error("Error fetching booking:", bookingError);
        throw new Error("Database error while fetching booking");
      }

      if (!bookingData) {
        throw new Error("Booking not found");
      }

      if (!bookingData.student_id) {
        throw new Error("Invalid booking data - no student ID");
      }

      // Try to refund credits to student (optional - don't fail if student not found)
      try {
        const { data: studentData, error: studentError } = await supabase
          .from("Students")
          .select("credits")
          .eq("id", bookingData.student_id)
          .maybeSingle();

        if (studentError) {
          console.warn(
            "Error fetching student for credit refund:",
            studentError
          );
        } else if (studentData) {
          const newCredits = (studentData.credits || 0) + creditsRequired;

          const { error: updateCreditsError } = await supabase
            .from("Students")
            .update({ credits: newCredits })
            .eq("id", bookingData.student_id);

          if (updateCreditsError) {
            console.warn("Error updating credits:", updateCreditsError);
          } else {
            console.log(
              `Successfully refunded ${creditsRequired} credits to student`
            );
          }
        } else {
          console.warn(
            `Student with ID ${bookingData.student_id} not found - skipping credit refund`
          );
        }
      } catch (creditError) {
        console.warn(
          "Credit refund failed, but continuing with rejection:",
          creditError
        );
      }

      // Update booking status to rejected
      const { error: updateBookingError } = await supabase
        .from("Schedules")
        .update({ status: "rejected" })
        .eq("id", bookingId);

      if (updateBookingError) {
        console.error("Error updating booking status:", updateBookingError);
        throw new Error("Failed to reject booking");
      }

      // Refresh bookings
      const { data: tutorData } = await supabase
        .from("Tutors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (tutorData) {
        const { data } = await supabase
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
          .in("status", ["pending", "confirmed", "rejected", "cancelled"])
          .order("start_time_utc", { ascending: true });

        setTutorBookings(data || []);
      }
    } catch (error) {
      console.error("Error rejecting booking:", error);
      const errorMessage =
        error.message || "Error rejecting booking. Please try again.";
      alert(errorMessage);
    } finally {
      setProcessing((prev) => ({ ...prev, [bookingId]: false }));
    }
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

  // Student view
  if (userRole === "student") {
    const upcomingSessions = scheduledMeetings.filter(
      (m) =>
        new Date(m.start_time_utc) > new Date() ||
        m.status === "pending" ||
        m.status === "confirmed"
    );
    const pastSessions = scheduledMeetings.filter(
      (m) => new Date(m.end_time_utc) < new Date() && m.status === "confirmed"
    );

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const formatTime = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    };

    const formatDuration = (minutes) => {
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0
        ? `${hours}h ${mins}min`
        : `${hours} hour${hours > 1 ? "s" : ""}`;
    };

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            Calendar
          </h2>
          <p className="text-sm text-slate-500">View your tutoring sessions</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setView("upcoming")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                view === "upcoming"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upcoming Sessions
            </button>
            <button
              onClick={() => setView("past")}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                view === "past"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Past Sessions
            </button>
          </div>

          <div className="p-4">
            {view === "upcoming" && (
              <div className="space-y-2">
                {upcomingSessions.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No upcoming sessions scheduled.</p>
                  </div>
                ) : (
                  upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900">
                          {session.subject || "Tutoring Session"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {session.tutor?.name || "Tutor"} •{" "}
                          {formatDate(session.start_time_utc)} at{" "}
                          {formatTime(session.start_time_utc)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Duration: {formatDuration(session.duration_min)}
                        </p>
                      </div>
                      {session.meeting_link ? (
                        <a
                          href={session.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-3 px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors whitespace-nowrap"
                        >
                          Join
                        </a>
                      ) : (
                        <span className="ml-3 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-sm font-medium whitespace-nowrap">
                          Pending
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {view === "past" && (
              <div className="space-y-2">
                {pastSessions.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No past sessions yet.</p>
                  </div>
                ) : (
                  pastSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900">
                          {session.subject || "Tutoring Session"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {session.tutor?.name || "Tutor"} •{" "}
                          {formatDate(session.start_time_utc)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Completed
                        </p>
                      </div>
                      <button className="ml-3 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors whitespace-nowrap">
                        View Details
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Tutor view
  // Filter out past pending bookings (they should have been auto-rejected)
  const pendingBookings = tutorBookings.filter(
    (booking) =>
      booking.status === "pending" && !isPastBooking(booking.start_time_utc)
  );
  // Filter out past confirmed/cancelled bookings
  const confirmedBookings = tutorBookings.filter(
    (booking) =>
      (booking.status === "confirmed" || booking.status === "cancelled") &&
      !isPastBooking(booking.start_time_utc)
  );
  // Filter out past rejected bookings
  const rejectedBookings = tutorBookings.filter(
    (booking) =>
      booking.status === "rejected" && !isPastBooking(booking.start_time_utc)
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">
          Meeting Requests
        </h2>
        <p className="text-sm text-slate-500">Manage your tutoring sessions</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setTutorView("pending")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              tutorView === "pending"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pending ({pendingBookings.length})
          </button>
          <button
            onClick={() => setTutorView("confirmed")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              tutorView === "confirmed"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Confirmed ({confirmedBookings.length})
          </button>
          <button
            onClick={() => setTutorView("rejected")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              tutorView === "rejected"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Rejected ({rejectedBookings.length})
          </button>
        </div>

        <div className="p-4">
          {/* Pending Requests Tab */}
          {tutorView === "pending" && (
            <div className="space-y-2">
              {pendingBookings.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">No pending meeting requests.</p>
                </div>
              ) : (
                pendingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-slate-900">
                          {booking.subject}
                        </p>
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        {booking.student?.name ||
                          booking.student?.email ||
                          "Student"}{" "}
                        • {formatDate(booking.start_time_utc)} at{" "}
                        {formatTime(booking.start_time_utc)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {booking.duration_min} min • {booking.credits_required}{" "}
                        credits
                      </p>
                    </div>
                    <div className="flex gap-2 ml-3">
                      <button
                        onClick={() => handleAcceptBooking(booking.id)}
                        disabled={processing[booking.id]}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
                      >
                        {processing[booking.id] === "accepting" ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Check className="h-3 w-3" />
                            Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          handleRejectBooking(
                            booking.id,
                            booking.credits_required
                          )
                        }
                        disabled={processing[booking.id]}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
                      >
                        {processing[booking.id] === "rejecting" ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            Reject
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Confirmed Meetings Tab */}
          {tutorView === "confirmed" && (
            <div className="space-y-2">
              {confirmedBookings.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">No confirmed meetings yet.</p>
                </div>
              ) : (
                confirmedBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      booking.status === "cancelled"
                        ? "bg-red-50 border-red-200"
                        : "bg-green-50 border-green-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-slate-900">
                          {booking.subject}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          booking.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {booking.status === "cancelled" ? "Cancelled" : booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        {booking.student?.name ||
                          booking.student?.email ||
                          "Student"}{" "}
                        • {formatDate(booking.start_time_utc)} at{" "}
                        {formatTime(booking.start_time_utc)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {booking.duration_min} min • {booking.credits_required}{" "}
                        credits {booking.status === "cancelled" ? "refunded" : ""}
                      </p>
                      {booking.cancellation_reason && (
                        <p className="text-xs text-red-700 mt-2 bg-red-100 p-2 rounded">
                          <span className="font-medium">Cancellation reason:</span> {booking.cancellation_reason}
                        </p>
                      )}
                      {booking.meeting_link && booking.status !== "cancelled" && (
                        <a
                          href={booking.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          <Link className="h-3 w-3" />
                          Join Meeting
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Rejected Requests Tab */}
          {tutorView === "rejected" && (
            <div className="space-y-2">
              {rejectedBookings.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <X className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">No rejected requests.</p>
                </div>
              ) : (
                rejectedBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm text-slate-900">
                          {booking.subject}
                        </p>
                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">
                          {booking.cancellation_reason ? "Cancelled" : booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        {booking.student?.name ||
                          booking.student?.email ||
                          "Student"}{" "}
                        • {formatDate(booking.start_time_utc)} at{" "}
                        {formatTime(booking.start_time_utc)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {booking.duration_min} min • {booking.credits_required}{" "}
                        credits refunded
                      </p>
                      {booking.cancellation_reason && (
                        <p className="text-xs text-red-700 mt-2 bg-red-100 p-2 rounded">
                          <span className="font-medium">Cancellation reason:</span> {booking.cancellation_reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Meeting Link Modal */}
      {meetingLinkModal.isOpen && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Link className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">
                  Add Meeting Link
                </h3>
              </div>
              <button
                onClick={handleCloseMeetingLinkModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <label
                  htmlFor="meetingLink"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Meeting Link (Zoom, Google Meet, etc.)
                </label>
                <input
                  type="url"
                  id="meetingLink"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://zoom.us/j/123456789 or https://meet.google.com/abc-defg-hij"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-slate-500"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Please provide a valid meeting link (Zoom, Google Meet,
                  Microsoft Teams, etc.)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCloseMeetingLinkModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBookingWithLink}
                  disabled={processing[meetingLinkModal.bookingId]}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  {processing[meetingLinkModal.bookingId] === "accepting" ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Accept & Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
