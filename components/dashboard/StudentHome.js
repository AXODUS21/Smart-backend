"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Clock, Zap, TrendingUp, Star } from "lucide-react";
import Link from "next/link";

export default function StudentHome({ setActiveTab }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    sessionsBooked: 0,
    creditsAvailable: 0,
    hoursCompleted: 0,
    avgRating: 4.5,
  });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [studentName, setStudentName] = useState("");
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Get student data
        const { data: studentData } = await supabase
          .from("Students")
          .select("id, name, credits")
          .eq("user_id", user.id)
          .single();

        if (studentData) {
          setStudentName(studentData.name || user.email);
          setMetrics((prev) => ({
            ...prev,
            creditsAvailable: studentData.credits || 0,
          }));

          // Get sessions
          const { data: sessions } = await supabase
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

          if (sessions) {
            const upcoming = sessions
              .filter((s) => new Date(s.start_time_utc) > new Date())
              .slice(0, 3);
            setUpcomingSessions(upcoming);

            const completed = sessions.filter(
              (s) =>
                s.status === "confirmed" &&
                new Date(s.end_time_utc) < new Date()
            );
            const hoursCompleted = completed.reduce(
              (total, session) => total + (session.duration_min || 0) / 60,
              0
            );

            setMetrics((prev) => ({
              ...prev,
              sessionsBooked: sessions.length,
              hoursCompleted: hoursCompleted.toFixed(1),
            }));

            // Set recent activity (last 3 confirmed sessions)
            const recent = completed
              .sort(
                (a, b) => new Date(b.end_time_utc) - new Date(a.end_time_utc)
              )
              .slice(0, 3)
              .map((session) => ({
                description: `Session completed with ${
                  session.tutor?.name || "tutor"
                }`,
                time: getTimeAgo(new Date(session.end_time_utc)),
              }));
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
  }, [user]);

  useEffect(() => {
    async function fetchAssignments() {
      if (!user) return;
      
      // First get the student's bigint ID
      const { data: studentData } = await supabase
        .from("Students")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (studentData) {
        // Now query assignments using the student's bigint ID
        const { data } = await supabase
          .from('Assignments')
          .select('*, tutor:tutor_id (name, email)')
          .eq('student_id', studentData.id)
          .order('created_at', {ascending: false});
        setAssignments(data || []);
      }
    }
    fetchAssignments();
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
    {
      title: "Avg Rating",
      value: metrics.avgRating.toString(),
      icon: Star,
      bgColor: "bg-orange-500",
      lightBg: "bg-orange-50",
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
      {/* Low credit warning notification */}
      {metrics.creditsAvailable < 4 && (
        <div className="flex items-center gap-4 bg-orange-100 border-l-4 border-orange-500 text-orange-800 px-4 py-3 rounded mb-2">
          <Zap className="text-orange-500" size={28} />
          <div className="flex-1">
            <div className="font-bold">Low Credits Warning</div>
            <div className="text-sm">Your credits are running low. Please purchase more to keep booking sessions!</div>
          </div>
          <button
            onClick={() => setActiveTab && setActiveTab("credits")}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-lg shadow transition-colors"
          >
            Buy Credits
          </button>
        </div>
      )}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Welcome Back, {studentName || user?.email}
        </h2>
        <p className="text-slate-500">{getCurrentDate()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      <div className="my-6">
        <h2 style={{fontWeight: 'bold'}}>Your Assignments</h2>
        <ul>{assignments.length === 0 ? <li>No assignments yet.</li> : assignments.map(a => <li key={a.id} style={{margin: '8px 0'}}>
          <strong>{a.title}</strong> from {a.tutor?.name || a.tutor?.email || 'Tutor'}: {a.description}
          {a.file_url && <a href={a.file_url} target="_blank" rel="noopener noreferrer">Download</a>}
          <br/>
          <span style={{fontSize: '0.9em', color: '#666'}}>Uploaded: {new Date(a.created_at).toLocaleString()}</span>
        </li>)}</ul>
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
                  </div>
                  <span className="text-sm font-medium text-blue-600">
                    {session.tutor?.name || "Tutor"}
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
    </div>
  );
}
