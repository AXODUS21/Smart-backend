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
  Menu,
  X,
  LogOut,
  Video,
  Home,
  Clock,
  MessageSquare,
  User,
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
import Header from "./Header";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const studentTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "find-tutors", label: "Book Sessions", icon: Search },
    { id: "meetings", label: "Calendar", icon: Video },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
    { id: "credits", label: "Buy Credits", icon: Wallet },
  ];

  const tutorTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "calendar", label: "Calendar", icon: CalendarIcon },
    { id: "meetings", label: "Booking Request", icon: Video },
    { id: "past-sessions", label: "Past Sessions", icon: Clock },
    { id: "profile", label: "Profile", icon: User },
  ];

  const tabs = userRole === "student" ? studentTabs : tutorTabs;

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
            ) : (
              <BookOpen className="w-8 h-8 text-green-600" />
            )}
            {sidebarOpen && (
              <span className="font-bold text-gray-900">
                {userRole === "student" ? "Student" : "Tutor"}
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
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
            if (userRole === "tutor") {
              setActiveTab("profile");
            }
          }}
        />

        <main className="flex-1 p-6">
          {activeTab === "home" && userRole === "student" && (
            <StudentHome setActiveTab={setActiveTab} />
          )}
          {activeTab === "home" && userRole === "tutor" && <TutorHome />}
          {activeTab === "credits" && userRole === "student" && <Credits />}
          {activeTab === "meetings" && userRole === "student" && <Meetings />}
          {activeTab === "find-tutors" && userRole === "student" && (
            <BookSession />
          )}
          {activeTab === "feedback" && userRole === "student" && (
            <StudentFeedback />
          )}
          {activeTab === "calendar" && userRole === "tutor" && <Calendar />}
          {activeTab === "meetings" && userRole === "tutor" && <Meetings />}
          {activeTab === "past-sessions" && userRole === "tutor" && (
            <PastSessions />
          )}
          {activeTab === "profile" && userRole === "tutor" && <TutorProfile />}
        </main>
      </div>
    </div>
  );
}
