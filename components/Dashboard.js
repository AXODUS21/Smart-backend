"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Wallet,
  Calendar as CalendarIcon,
  Users,
  Search,
  GraduationCap,
  BookOpen,
  ChevronRight,
  X,
  LogOut,
  Video,
  Home,
  Clock,
  MessageSquare,
  User,
  Shield,
  BarChart3,
  Briefcase,
  CheckSquare,
} from "lucide-react";

// Dashboard components
import Credits from "./dashboard/Credits";
import Meetings from "./dashboard/Meetings";
import BookSession from "./dashboard/BookSession";
import Calendar from "./dashboard/Calendar";
import TutorHome from "./dashboard/TutorHome";
import StudentHome from "./dashboard/StudentHome";
import PastSessions from "./dashboard/PastSessions";
import StudentFeedback from "./dashboard/StudentFeedback";
import TutorProfile from "./dashboard/TutorProfile";
import StudentProfile from "./dashboard/StudentProfile";
import AdminDashboard from "./dashboard/AdminDashboard";
import AdminAnalytics from "./dashboard/AdminAnalytics";
import AdminUsers from "./dashboard/AdminUsers";
import AdminJobs from "./dashboard/AdminJobs";
import AdminTasks from "./dashboard/AdminTasks";
import AdminSubjects from "./dashboard/AdminSubjects";
import StudentReview from "./dashboard/StudentReview";
import AdminParentsReview from "./dashboard/AdminParentsReview";
import Header from "./Header";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [studentModeEnabled, setStudentModeEnabled] = useState(false);

  // Handle URL parameters for tab selection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  useEffect(() => {
    async function determineRole() {
      if (!user) return;

      try {
        // First check if user is an admin
        const { data: adminData } = await supabase
          .from("admins")
          .select("id, name, email")
          .eq("user_id", user.id)
          .single();

        if (adminData) {
          setUserRole("admin");
          setUserName(adminData.name || user.email);
          setLoading(false);
          return;
        }

        // Check if user is in Students table
        const { data: studentData } = await supabase
          .from("Students")
          .select("id, name, email, credits")
          .eq("user_id", user.id)
          .single();

        if (studentData) {
          setUserRole("student");
          setUserName(studentData.name || user.email);
        } else {
          // Check if user is in Tutors table
          const { data: tutorData } = await supabase
            .from("Tutors")
            .select("id, name, email, subjects")
            .eq("user_id", user.id)
            .single();

          if (tutorData) {
            setUserRole("tutor");
            setUserName(tutorData.name || user.email);
          }
        }
      } catch (error) {
        console.error("Error determining role:", error);
      } finally {
        setLoading(false);
      }
    }

    determineRole();
  }, [user]);

  // Load persisted student mode from localStorage per user
  useEffect(() => {
    if (!user) return;
    try {
      const key = `student_mode_${user.id}`;
      const v = localStorage.getItem(key);
      if (v === "true") setStudentModeEnabled(true);
    } catch {}
  }, [user]);

  const handleChangeStudentMode = (enabled) => {
    setStudentModeEnabled(enabled);
    if (user) {
      try {
        localStorage.setItem(`student_mode_${user.id}`, enabled ? "true" : "false");
      } catch {}
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const studentTabsBase = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "find-tutors", label: "Book Sessions", icon: Search },
    { id: "meetings", label: "Calendar", icon: Video },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
    { id: "profile", label: "Profile", icon: User },
  ];
  const studentTabs = studentModeEnabled
    ? studentTabsBase // hide Buy Credits
    : [...studentTabsBase, { id: "credits", label: "Buy Credits", icon: Wallet }];

  const tutorTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "calendar", label: "Calendar", icon: CalendarIcon },
    { id: "meetings", label: "Booking Request", icon: Video },
    { id: "past-sessions", label: "Past Sessions", icon: Clock },
    { id: "profile", label: "Profile", icon: User },
  ];

  const adminTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "jobs", label: "Jobs", icon: Briefcase },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "subjects", label: "Subjects", icon: CheckSquare },
    { id: "parents-review", label: "Parents Review", icon: MessageSquare },
  ];

  const tabs =
    userRole === "student"
      ? (studentModeEnabled
          ? studentTabs
          : [...studentTabs, { id: "review", label: "Review", icon: MessageSquare }])
      : userRole === "tutor"
      ? tutorTabs
      : userRole === "admin"
      ? adminTabs
      : [];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen fixed`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {userRole === "student" ? (
              <GraduationCap className="w-8 h-8 text-blue-600" />
            ) : userRole === "tutor" ? (
              <BookOpen className="w-8 h-8 text-green-600" />
            ) : (
              <Shield className="w-8 h-8 text-purple-600" />
            )}
            {sidebarOpen && (
              <span className="font-bold text-gray-900">
                {userRole === "student"
                  ? "Student"
                  : userRole === "tutor"
                  ? "Tutor"
                  : "Admin"}
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-slate-700" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-700" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3 px-4 py-2 text-sm text-gray-600">
            {sidebarOpen && <div className="truncate">{user?.email}</div>}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-y-auto ${
          sidebarOpen ? "ml-64" : "ml-20"
        } transition-all duration-300`}
      >
        <Header
          userName={userName}
          onProfileClick={() => {
            if (userRole === "tutor" || userRole === "student") {
              setActiveTab("profile");
            }
          }}
        />

        <main className="flex-1 p-6">
          {activeTab === "home" && userRole === "student" && (
            <StudentHome setActiveTab={setActiveTab} />
          )}
          {activeTab === "home" && userRole === "tutor" && <TutorHome />}
          {activeTab === "home" && userRole === "admin" && <AdminDashboard />}
          {activeTab === "analytics" && userRole === "admin" && (
            <AdminAnalytics />
          )}
          {activeTab === "users" && userRole === "admin" && <AdminUsers />}
          {activeTab === "jobs" && userRole === "admin" && <AdminJobs />}
          {activeTab === "tasks" && userRole === "admin" && <AdminTasks />}
          {activeTab === "subjects" && userRole === "admin" && (
            <AdminSubjects />
          )}
          {activeTab === "credits" && userRole === "student" && <Credits />}
          {activeTab === "meetings" && userRole === "student" && <Meetings />}
          {activeTab === "find-tutors" && userRole === "student" && (
            <BookSession />
          )}
          {activeTab === "feedback" && userRole === "student" && (
            <StudentFeedback />
          )}
          {activeTab === "review" && userRole === "student" && (
            <StudentReview />
          )}
          {activeTab === "calendar" && userRole === "tutor" && <Calendar />}
          {activeTab === "meetings" && userRole === "tutor" && <Meetings />}
          {activeTab === "past-sessions" && userRole === "tutor" && (
            <PastSessions />
          )}
          {activeTab === "profile" && userRole === "tutor" && <TutorProfile />}
          {activeTab === "profile" && userRole === "student" && (
            <StudentProfile
              studentModeEnabled={studentModeEnabled}
              onChangeStudentMode={handleChangeStudentMode}
              onCancel={() => setActiveTab("home")}
            />
          )}
          {activeTab === "parents-review" && userRole === "admin" && (
            <AdminParentsReview />
          )}
        </main>
      </div>
    </div>
  );
}
