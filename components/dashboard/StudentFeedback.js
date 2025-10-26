"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Star, MessageSquare } from "lucide-react";

export default function StudentFeedback() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch feedback for the student
  useEffect(() => {
    const fetchFeedback = async () => {
      if (!user) return;

      try {
        // Get student ID first
        const { data: studentData } = await supabase
          .from("Students")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!studentData) return;

        // Fetch sessions with tutor reviews (feedback)
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
          .eq("session_status", "successful")
          .not("tutor_review", "is", null)
          .order("start_time_utc", { ascending: false });

        if (error) {
          console.error("Error fetching feedback:", error);
        } else {
          // Transform data to match component structure
          const transformedFeedback = (data || []).map((session) => ({
            id: session.id,
            tutor: session.tutor?.name || session.tutor?.email || "Tutor",
            subject: session.subject || "Tutoring Session",
            date: formatDate(session.start_time_utc),
            rating: 5, // Default rating since we don't have a rating system yet
            feedback: session.tutor_review || "",
          }));
          setFeedbackList(transformedFeedback);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [user]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { month: "short", day: "numeric", year: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < rating ? "text-yellow-400 fill-current" : "text-gray-300"
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Feedback
          </h2>
          <p className="text-slate-500">View feedback from your tutors</p>
        </div>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg p-6 shadow-sm border border-slate-200"
            >
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Feedback</h2>
        <p className="text-slate-500">View feedback from your tutors</p>
      </div>

      <div className="space-y-4">
        {feedbackList.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No feedback yet</p>
            <p className="text-sm">
              Complete some sessions to receive feedback from your tutors.
            </p>
          </div>
        ) : (
          feedbackList.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{item.tutor}</p>
                  <p className="text-sm text-slate-500">
                    {item.subject} • {item.date}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {renderStars(item.rating)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-slate-700 leading-relaxed">
                  {item.feedback}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
