"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Users, Clock, TrendingUp, Award } from "lucide-react";

export default function TutorHome() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [tutorName, setTutorName] = useState("");
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    hoursTaught: 0,
    avgRating: 0,
    creditsEarned: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);

  const metricsData = [
    {
      title: "Total Students",
      value: metrics.totalStudents.toString(),
      icon: Users,
      bgColor: "bg-blue-500",
      lightBg: "bg-blue-50",
    },
    {
      title: "Hours Taught",
      value: metrics.hoursTaught.toString(),
      icon: Clock,
      bgColor: "bg-purple-500",
      lightBg: "bg-purple-50",
    },
    {
      title: "Avg Rating",
      value: metrics.avgRating > 0 ? metrics.avgRating.toFixed(1) : "N/A",
      icon: Award,
      bgColor: "bg-emerald-500",
      lightBg: "bg-emerald-50",
    },
    {
      title: "Credits Earned",
      value: metrics.creditsEarned.toString(),
      icon: TrendingUp,
      bgColor: "bg-orange-500",
      lightBg: "bg-orange-50",
    },
  ];

  const allSubjects = [
    "Mathematics",
    "Physics",
    "Chemistry",
    "English",
    "Biology",
    "History",
    "Computer Science",
    "Economics",
    "Geography",
    "Spanish",
    "French",
    "German",
    "Art",
    "Music",
    "Physical Education",
    "Statistics",
    "Calculus",
    "Algebra",
    "Geometry",
    "Trigonometry",
    "Literature",
    "Psychology",
  ];

  // Fetch tutor data and metrics
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Get tutor info
        const { data: tutorData, error: tutorError } = await supabase
          .from("Tutors")
          .select("id, name, subjects")
          .eq("user_id", user.id)
          .single();

        if (tutorError) {
          console.error("Error fetching tutor data:", tutorError);
        } else {
          setTutorName(tutorData?.name || user.email);
          setSubjects(tutorData?.subjects || []);
        }

        // Get tutor ID
        const { data: tutorInfo } = await supabase
          .from("Tutors")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (tutorInfo) {
          // Fetch all sessions
          const { data: sessions, error: sessionsError } = await supabase
            .from("Schedules")
            .select("*")
            .eq("tutor_id", tutorInfo.id);

          if (sessionsError) {
            console.error("Error fetching sessions:", sessionsError);
          } else if (sessions) {
            // Calculate metrics
            const confirmedSessions = sessions.filter(
              (s) => s.status === "confirmed"
            );

            // Total unique students
            const uniqueStudents = new Set(sessions.map((s) => s.student_id));

            // Hours taught
            const hoursTaught = confirmedSessions.reduce(
              (total, session) => total + (session.duration_min || 0) / 60,
              0
            );

            // Credits earned
            const creditsEarned = confirmedSessions.reduce(
              (total, session) => total + (session.credits_required || 0),
              0
            );

            setMetrics({
              totalStudents: uniqueStudents.size,
              hoursTaught: Math.round(hoursTaught * 10) / 10,
              avgRating: 4.9, // Default or fetch from ratings table if available
              creditsEarned,
            });

            // Get upcoming sessions (next 3)
            const upcoming = sessions
              .filter(
                (s) =>
                  s.status === "confirmed" &&
                  new Date(s.start_time_utc) > new Date()
              )
              .sort(
                (a, b) =>
                  new Date(a.start_time_utc) - new Date(b.start_time_utc)
              )
              .slice(0, 3);

            setUpcomingSessions(upcoming);
          }
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Add a new subject
  const handleAddSubject = async (subject) => {
    if (!subject || subjects.includes(subject)) return;

    setSaving(true);
    setSuccess("");

    try {
      const updatedSubjects = [...subjects, subject];

      const { error } = await supabase
        .from("Tutors")
        .update({ subjects: updatedSubjects })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setSubjects(updatedSubjects);
      setNewSubject("");
      setSuccess(`Added "${subject}" to your subjects!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error adding subject:", error);
      alert("Error adding subject. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Remove a subject
  const handleRemoveSubject = async (subjectToRemove) => {
    setSaving(true);
    setSuccess("");

    try {
      const updatedSubjects = subjects.filter(
        (subject) => subject !== subjectToRemove
      );

      const { error } = await supabase
        .from("Tutors")
        .update({ subjects: updatedSubjects })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setSubjects(updatedSubjects);
      setSuccess(`Removed "${subjectToRemove}" from your subjects.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error removing subject:", error);
      alert("Error removing subject. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { month: "short", day: "numeric", year: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  // Format time for display
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours() % 12 || 12;
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = date.getHours() >= 12 ? "PM" : "AM";
    return `${hours}:${minutes} ${ampm}`;
  };

  // Get today's date
  const today = new Date();
  const todayFormatted = today.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Welcome Back, {tutorName}
        </h2>
        <p className="text-slate-500">{todayFormatted}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricsData.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className={`${metric.bgColor} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${metric.lightBg} p-3 rounded-lg`}>
                  <Icon
                    size={24}
                    className={metric.bgColor.replace("bg-", "text-")}
                  />
                </div>
              </div>
              <p className="text-white/80 text-sm font-medium mb-1">
                {metric.title}
              </p>
              <p className="text-3xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Manage Subjects */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Subjects You Teach
          </h3>

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          <div className="space-y-3 mb-4">
            {subjects.length === 0 ? (
              <p className="text-slate-500 italic">
                No subjects added yet. Add some subjects to start teaching!
              </p>
            ) : (
              subjects.map((subject) => (
                <div
                  key={subject}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <span className="font-medium text-slate-900">{subject}</span>
                  <button
                    onClick={() => handleRemoveSubject(subject)}
                    disabled={saving}
                    className="text-red-600 hover:text-red-700 font-medium text-sm disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="">Add a subject...</option>
              {allSubjects
                .filter((s) => !subjects.includes(s))
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
            <button
              onClick={() => handleAddSubject(newSubject)}
              disabled={saving || !newSubject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Upcoming Sessions
          </h3>
          <div className="space-y-3">
            {upcomingSessions.length === 0 ? (
              <p className="text-slate-500 italic">
                No upcoming sessions scheduled.
              </p>
            ) : (
              upcomingSessions.map((session, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {session.subject}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDate(session.start_time_utc)} •{" "}
                      {formatTime(session.start_time_utc)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-blue-600">
                    {(session.duration_min / 60).toFixed(1)}{" "}
                    {session.duration_min / 60 === 1 ? "hour" : "hours"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
