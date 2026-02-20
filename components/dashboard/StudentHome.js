"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Clock,
  Zap,
  TrendingUp,
  Megaphone,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import {
  getActiveProfile,
  buildPrimaryProfileName,
  DEFAULT_PROFILE_ID,
} from "@/lib/studentProfiles";

export default function StudentHome({ setActiveTab, overrideStudentId }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    sessionsBooked: 0,
    creditsAvailable: 0,
    hoursCompleted: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [studentName, setStudentName] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [studentRecord, setStudentRecord] = useState(null);
  const activeProfile = studentRecord ? getActiveProfile(studentRecord) : null;
  const activeProfileName = activeProfile
    ? activeProfile.name
    : studentRecord
    ? buildPrimaryProfileName(studentRecord)
    : null;

  useEffect(() => {
    if (!user && !overrideStudentId) return;

    const fetchData = async () => {
      try {
        let studentData = null;
        let principalCredits = null;
        let schoolName = null;
        let isSchoolView = false;
        let schoolId = null;
        
        if (overrideStudentId) {
          // overrideStudentId is actually a school ID when principal views as school
          // First try to fetch as a school
          const { data: schoolData } = await supabase
            .from("Schools")
            .select("id, name")
            .eq("id", overrideStudentId)
            .single();
          
          if (schoolData) {
            // This is a school view - fetch principal credits
            schoolName = schoolData.name;
            isSchoolView = true;
            schoolId = schoolData.id;
            const { data: pri } = await supabase.from("Principals").select("credits").eq("user_id", user.id).single();
            principalCredits = pri?.credits ?? 0;
            
            // Create a pseudo-student data object for the school view
            studentData = {
              id: schoolData.id,
              first_name: schoolData.name,
              last_name: "",
              isSchool: true,
            };
          } else {
            // Fallback: try fetching as a student ID (for backwards compatibility)
            const { data } = await supabase
              .from("Students")
              .select("id, first_name, last_name, extra_profiles, active_profile_id")
              .eq("id", overrideStudentId)
              .single();
            studentData = data;
            const { data: pri } = await supabase.from("Principals").select("credits").eq("user_id", user.id).single();
            principalCredits = pri?.credits ?? 0;
          }
        } else {
          const { data } = await supabase
            .from("Students")
            .select("id, first_name, last_name, credits, extra_profiles, active_profile_id")
            .eq("user_id", user.id)
            .single();
          studentData = data;
        }

        if (studentData) {
          setStudentRecord(studentData);
          const fullName = schoolName || `${studentData.first_name || ""} ${studentData.last_name || ""}`.trim();
          setStudentName(fullName || studentData.email || (user?.email) || "");
          setMetrics((prev) => ({
            ...prev,
            creditsAvailable: overrideStudentId ? principalCredits : (studentData.credits || 0),
          }));

          const profileIdFilter =
            studentData.active_profile_id || DEFAULT_PROFILE_ID;

          // Build session query based on whether it's a school or student view
          let sessionsQuery = supabase
            .from("Schedules")
            .select(
              `
              *,
              tutor:tutor_id (
                first_name,
                last_name
              )
            `
            );
          
          // Filter by school_id or student_id
          if (isSchoolView) {
            sessionsQuery = sessionsQuery.eq("school_id", schoolId);
          } else {
            sessionsQuery = sessionsQuery.eq("student_id", studentData.id);
          }
          
          // Get sessions
          const { data: sessions } = await sessionsQuery.order("start_time_utc", { ascending: true });

          if (sessions) {
            const relevantSessions = sessions.filter((session) => {
              if (!session.profile_id) {
                return profileIdFilter === DEFAULT_PROFILE_ID;
              }
              return session.profile_id === profileIdFilter;
            });

            const upcoming = relevantSessions
              .filter((s) => {
                const isFuture = new Date(s.start_time_utc) > new Date();
                const isActive = ["confirmed", "pending"].includes(s.status);
                return isFuture && isActive;
              })
              .slice(0, 3);
            setUpcomingSessions(upcoming);

            const completed = relevantSessions.filter(
              (s) =>
                (s.status === "confirmed" || s.status === "successful") &&
                new Date(s.end_time_utc) < new Date() &&
                s.no_show_type !== "tutor-no-show" // Exclude sessions where tutor didn't show up
            );
            const hoursCompleted = completed.reduce(
              (total, session) => total + (session.duration_min || 0) / 60,
              0
            );

            setMetrics((prev) => ({
              ...prev,
              sessionsBooked: relevantSessions.length,
              hoursCompleted: hoursCompleted.toFixed(1),
            }));

            // Set recent activity (last 3 confirmed sessions)
            const recent = completed
              .sort(
                (a, b) => new Date(b.end_time_utc) - new Date(a.end_time_utc)
              )
              .slice(0, 3)
              .map((session) => {
                const tutorFullName = session.tutor
                  ? `${session.tutor.first_name || ""} ${
                      session.tutor.last_name || ""
                    }`.trim()
                  : "";
                return {
                  description: `Session completed with ${
                    tutorFullName || "tutor"
                  }`,
                  time: getTimeAgo(new Date(session.end_time_utc)),
                };
              });
            setRecentActivity(recent);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, overrideStudentId]);

  // Fetch announcements for students
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

        // Filter client-side for students
        const filtered = (data || []).filter(
          (ann) =>
            !ann.target_audience ||
            ann.target_audience.length === 0 ||
            ann.target_audience.includes("students")
        );

        setAnnouncements(filtered.slice(0, 5));
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };

    fetchAnnouncements();
  }, [user]);

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  };

  const getCurrentDate = () => {
    const today = new Date();
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return `Today | ${
      months[today.getMonth()]
    } ${today.getDate()}, ${today.getFullYear()}`;
  };

  const metricData = [
    {
      title: "Sessions Booked",
      value: metrics.sessionsBooked.toString(),
      icon: Clock,
      bgColor: "bg-blue-500",
      lightBg: "bg-blue-50",
    },
    {
      title: "Credits Available",
      value: metrics.creditsAvailable.toString(),
      icon: Zap,
      bgColor: "bg-purple-500",
      lightBg: "bg-purple-50",
    },
    {
      title: "Hours Completed",
      value: metrics.hoursCompleted.toString(),
      icon: TrendingUp,
      bgColor: "bg-emerald-500",
      lightBg: "bg-emerald-50",
    },

  ];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Low credit warning: only for real students; principal's students use shared credits, principal adds in Principal view */}
      {!overrideStudentId && metrics.creditsAvailable < 4 && (
        <div className="flex items-center gap-4 bg-orange-100 border-l-4 border-orange-500 text-orange-800 px-4 py-3 rounded mb-2">
          <Zap className="text-orange-500" size={28} />
          <div className="flex-1">
            <div className="font-bold">Low Credits Warning</div>
            <div className="text-sm">
              Your credits are running low. Please purchase more to keep booking
              sessions!
            </div>
          </div>
          <button
            onClick={() => setActiveTab && setActiveTab("credits")}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg shadow transition-colors"
          >
            Buy Credits
          </button>
        </div>
      )}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Welcome Back, {activeProfileName || studentName || user?.email}
        </h2>
        <p className="text-slate-500">{getCurrentDate()}</p>
        {activeProfileName && (
          <p className="text-xs text-slate-500 mt-1">
            Viewing dashboard for{" "}
            <span className="font-medium">{activeProfileName}</span>. Switch
            profiles in Student Settings.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricData.map((metric, index) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Sessions */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Upcoming Sessions
          </h3>
          {upcomingSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No upcoming sessions scheduled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {session.subject || "Tutoring Session"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(session.start_time_utc).toLocaleDateString()} •{" "}
                      {new Date(session.start_time_utc).toLocaleTimeString()}
                    </p>
                    {session.profile_name && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Profile:{" "}
                        <span className="font-medium">
                          {session.profile_name}
                        </span>
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-blue-600">
                    {session.tutor
                      ? `${session.tutor.first_name || ""} ${
                          session.tutor.last_name || ""
                        }`.trim() || "Tutor"
                      : "Tutor"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Recent Activity
          </h3>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                >
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
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
