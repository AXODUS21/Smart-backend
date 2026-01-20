"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Users, Clock, TrendingUp, Award, Megaphone } from "lucide-react";

export default function TutorHome() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawMessage, setWithdrawMessage] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [assignmentUpload, setAssignmentUpload] = useState({
    title: "",
    description: "",
    file: null,
    studentId: "",
  });
  const [assignmentMsg, setAssignmentMsg] = useState("");
  const [students, setStudents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [tutorId, setTutorId] = useState(null);

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

  // Fetch tutor data and metrics - fetch tutor ID once
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Get tutor info (single query to get all needed data)
        const { data: tutorData, error: tutorError } = await supabase
          .from("Tutors")
          .select("id, name, subjects")
          .eq("user_id", user.id)
          .single();

        if (tutorError) {
          console.error("Error fetching tutor data:", tutorError);
          setLoading(false);
          return;
        }

        if (!tutorData) {
          setLoading(false);
          return;
        }

        // Store tutor ID for other queries
        setTutorId(tutorData.id);
        const fullName = `${tutorData.first_name || ''} ${tutorData.last_name || ''}`.trim();
        setTutorName(fullName || user.email);
        
        // Handle both old format (text array) and new format (object array)
        const subjectsData = tutorData.subjects || [];
        const normalizedSubjects = subjectsData.map((subj) => {
          if (typeof subj === "string") {
            return { subject: subj, grade_level: null };
          }
          return subj;
        });
        setSubjects(normalizedSubjects);

        // Fetch all sessions using tutor ID
        const { data: sessions, error: sessionsError } = await supabase
          .from("Schedules")
          .select("*")
          .eq("tutor_id", tutorData.id);

        if (sessionsError) {
          console.error("Error fetching sessions:", sessionsError);
        } else if (sessions) {
          // Calculate metrics
          // Count earnings only after tutor review is submitted (completed sessions)
          const completedSessions = sessions.filter(
            (s) =>
              s.status === "confirmed" &&
              (s.session_status === "successful" || s.session_action === "review-submitted")
          );

          // Total unique students
          const uniqueStudents = new Set(sessions.map((s) => s.student_id));

          // Hours taught
          const hoursTaught = completedSessions.reduce(
            (total, session) => total + (session.duration_min || 0) / 60,
            0
          );

          // Credits earned
          const creditsEarned = completedSessions.reduce(
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
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Fetch withdrawals for tutor (depends on tutorId)
  useEffect(() => {
    async function fetchWithdrawals() {
      if (!tutorId) return;
      
      const { data } = await supabase
        .from("TutorWithdrawals")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("requested_at", { ascending: false });
      setWithdrawals(data || []);
    }
    fetchWithdrawals();
  }, [tutorId]);
  // Fetch students (for assignments) - depends on tutorId
  useEffect(() => {
    async function fetchStudents() {
      if (!tutorId) return;
      const { data } = await supabase
        .from("Tutors")
        .select("students_id")
        .eq("id", tutorId)
        .single();
      setStudents(data?.students_id || []);
    }
    fetchStudents();
  }, [tutorId]);
  // Fetch assignments uploaded by tutor (depends on tutorId)
  useEffect(() => {
    async function fetchAssignments() {
      if (!tutorId) return;
      
      const { data } = await supabase
        .from("Assignments")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("created_at", { ascending: false });
      setAssignments(data || []);
    }
    fetchAssignments();
  }, [tutorId]);

  // Fetch announcements for tutors
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("Announcements")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        // Filter client-side for tutors
        const filtered = (data || []).filter(
          (ann) =>
            !ann.target_audience ||
            ann.target_audience.length === 0 ||
            ann.target_audience.includes("tutors")
        );

        setAnnouncements(filtered.slice(0, 5));
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };

    fetchAnnouncements();
  }, [user]);

  // Remove a subject (by index since subjects are now objects)
  const handleRemoveSubject = async (indexToRemove) => {
    setSaving(true);
    setSuccess("");

    try {
      const subjectToRemove = subjects[indexToRemove];
      const updatedSubjects = subjects.filter(
        (_, index) => index !== indexToRemove
      );

      const { error } = await supabase
        .from("Tutors")
        .update({ subjects: updatedSubjects })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setSubjects(updatedSubjects);
      setSuccess(
        `Removed "${
          subjectToRemove.subject || subjectToRemove
        }" from your subjects.`
      );
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

  // 1. Place these inside the function body of TutorHome, before return
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setWithdrawMessage("");
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) {
      setWithdrawMessage("Enter a valid amount");
      return;
    }
    if (!tutorId) {
      setWithdrawMessage("Could not find your tutor record.");
      return;
    }
    const { error } = await supabase
      .from("TutorWithdrawals")
      .insert({ tutor_id: tutorId, amount: amt });
    if (error) setWithdrawMessage("Error: " + error.message);
    else {
      setWithdrawMessage("Request submitted!");
      setWithdrawAmount(0);
      // Re-fetch withdrawals
      const { data } = await supabase
        .from("TutorWithdrawals")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("requested_at", { ascending: false });
      setWithdrawals(data || []);
    }
  };
  const handleAssignmentUpload = async (e) => {
    e.preventDefault();
    setAssignmentMsg("");
    if (
      !assignmentUpload.title ||
      !assignmentUpload.studentId ||
      !assignmentUpload.file
    ) {
      setAssignmentMsg("Fill out all fields and select a file!");
      return;
    }
    if (!tutorId) {
      setAssignmentMsg("Could not find your tutor record.");
      return;
    }
    // Upload file to Supabase storage (bucket 'assignments')
    const filePath = `${tutorId}_${Date.now()}_${assignmentUpload.file.name}`;
    let fileUrl = "";
    const { data: storageData, error: storageErr } = await supabase.storage
      .from("assignments")
      .upload(filePath, assignmentUpload.file);
    if (storageErr) {
      setAssignmentMsg("File upload error: " + storageErr.message);
      return;
    }
    fileUrl = storageData?.path || storageData?.Key || "";
    // Save new assignment record
    const { error } = await supabase
      .from("Assignments")
      .insert({
        tutor_id: tutorId,
        student_id: assignmentUpload.studentId,
        title: assignmentUpload.title,
        description: assignmentUpload.description,
        file_url: fileUrl,
      });
    if (error) setAssignmentMsg("Error: " + error.message);
    else {
      setAssignmentMsg("Assignment uploaded!");
      setAssignmentUpload({
        title: "",
        description: "",
        file: null,
        studentId: "",
      });
      // Refresh assignments
      const { data } = await supabase
        .from("Assignments")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("created_at", { ascending: false });
      setAssignments(data || []);
    }
  };
  // 2. Build tab JSX as separate clean blocks (inside return, example for assignments/payments only):

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
                <div className="bg-white/20 p-3 rounded-lg">
                  <Icon size={24} className="text-white" />
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

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Annoucement</h3>
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`p-4 rounded-lg border-l-4 ${
                announcement.priority === "urgent"
                  ? "bg-red-50 border-red-500"
                  : announcement.priority === "high"
                  ? "bg-orange-50 border-orange-500"
                  : "bg-blue-50 border-blue-500"
              }`}
            >
              <div className="flex items-start gap-3">
                <Megaphone
                  className={`w-5 h-5 mt-0.5 ${
                    announcement.priority === "urgent"
                      ? "text-red-600"
                      : announcement.priority === "high"
                      ? "text-orange-600"
                      : "text-blue-600"
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900">
                      {announcement.title}
                    </h3>
                    {announcement.priority === "urgent" && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {announcement.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
