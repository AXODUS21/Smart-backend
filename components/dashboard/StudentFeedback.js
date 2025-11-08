"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { MessageSquare } from "lucide-react";

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

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            Feedback
          </h2>
          <p className="text-sm text-slate-500">View feedback from your tutors</p>
        </div>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg p-3 shadow-sm border border-slate-200"
            >
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">Feedback</h2>
        <p className="text-sm text-slate-500">View feedback from your tutors</p>
      </div>

      <div className="space-y-2">
        {feedbackList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-medium mb-1">No feedback yet</p>
            <p className="text-sm">
              Complete some sessions to receive feedback from your tutors.
            </p>
          </div>
        ) : (
          feedbackList.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="mb-2">
                <p className="font-semibold text-sm text-slate-900">{item.tutor}</p>
                <p className="text-xs text-slate-500">
                  {item.subject} • {item.date}
                </p>
              </div>
              <div className="bg-slate-50 rounded p-2">
                <p className="text-sm text-slate-700 leading-snug">
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
