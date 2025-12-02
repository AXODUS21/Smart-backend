"use client";

import { useState, useEffect, useCallback } from "react";
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
  ShieldCheck,
  BarChart3,
  Briefcase,
  CheckSquare,
  Megaphone,
  Settings,
  ListTodo,
  FileText,
  ClipboardList,
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
import AdminServices from "./dashboard/AdminServices";
import AdminUsers from "./dashboard/AdminUsers";
import AdminJobs from "./dashboard/AdminJobs";
import AdminTasks from "./dashboard/AdminTasks";
import AdminSubjects from "./dashboard/AdminSubjects";
import AdminCreditPlans from "./dashboard/AdminCreditPlans";
import StudentReview from "./dashboard/StudentReview";
import AdminParentsReview from "./dashboard/AdminParentsReview";
import TutorAssignments from "./dashboard/TutorAssignments";
import StudentAssignments from "./dashboard/StudentAssignments";
import AdminAnnouncements from "./dashboard/AdminAnnouncements";
import SuperadminSidebarConfig from "./dashboard/SuperadminSidebarConfig";
import SuperadminTasks from "./dashboard/SuperadminTasks";
import AdminTutorApplications from "./dashboard/AdminTutorApplications";
import TutorApplication from "./dashboard/TutorApplication";
import SessionManagement from "./dashboard/SessionManagement";
import Header from "./Header";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [studentModeEnabled, setStudentModeEnabled] = useState(false);
  const [adminSidebarConfig, setAdminSidebarConfig] = useState([]);
  const [tutorApplicationApproved, setTutorApplicationApproved] = useState(null);
  const [tutorId, setTutorId] = useState(null);

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

  // Load admin sidebar configuration for the current admin
  const loadAdminSidebarConfig = async (adminId) => {
    try {
      const { data, error } = await supabase
        .from("admin_sidebar_config")
        .select("*")
        .eq("admin_id", adminId)
        .eq("is_visible", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setAdminSidebarConfig(data || []);
    } catch (error) {
      console.error("Error loading admin sidebar config:", error);
      // Fallback to default tabs if config fails to load
      setAdminSidebarConfig([]);
    }
  };

  useEffect(() => {
    async function determineRole() {
      if (!user) return;

      try {
        // First check if user is a superadmin
        const { data: superadminData, error: superadminError } = await supabase
          .from("superadmins")
          .select("id, name, email")
          .eq("user_id", user.id)
          .maybeSingle();
        
        // Ignore 406 errors (not found is expected for non-superadmins)
        if (superadminError && superadminError.code !== 'PGRST116') {
          console.error("Error checking superadmin status:", superadminError);
        }

        if (superadminData) {
          setUserRole("superadmin");
          setUserName(superadminData.name || user.email);
          setLoading(false);
          return;
        }

        // Then check if user is an admin
        const { data: adminData, error: adminError } = await supabase
          .from("admins")
          .select("id, name, email")
          .eq("user_id", user.id)
          .maybeSingle();
        
        // Ignore 406 errors (not found is expected for non-admins)
        if (adminError && adminError.code !== 'PGRST116') {
          console.error("Error checking admin status:", adminError);
        }

        if (adminData) {
          setUserRole("admin");
          setUserName(adminData.name || user.email);
          // Load admin sidebar configuration for this specific admin
          await loadAdminSidebarConfig(adminData.id);
          setLoading(false);
          return;
        }

        // Check if user is in Students table
        const { data: studentData, error: studentError } = await supabase
          .from("Students")
          .select("id, first_name, last_name, email, credits")
          .eq("user_id", user.id)
          .maybeSingle();

        if (studentData) {
          setUserRole("student");
          const fullName = `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim();
          setUserName(fullName || user.email);
        } else {
          // Check if user is in Tutors table
          const { data: tutorData, error: tutorError } = await supabase
            .from("Tutors")
            .select("id, first_name, last_name, email, subjects, application_status")
            .eq("user_id", user.id)
            .maybeSingle();

          if (tutorData) {
            setUserRole("tutor");
            const fullName = `${tutorData.first_name || ''} ${tutorData.last_name || ''}`.trim();
            setUserName(fullName || user.email);
            setTutorId(tutorData.id);
            const isApproved = Boolean(tutorData.application_status);
            setTutorApplicationApproved(isApproved);
            if (!isApproved) {
              setActiveTab("application");
            }
          } else {
            // Profile doesn't exist - try to create it from user metadata
            const userType = user.user_metadata?.user_type;
            const userFirstName = user.user_metadata?.first_name || '';
            const userLastName = user.user_metadata?.last_name || '';

            if (userType === 'student') {
              // Create student profile
              const { data: newStudent, error: createError } = await supabase
                .from("Students")
                .insert({
                  user_id: user.id,
                  first_name: userFirstName,
                  last_name: userLastName,
                  email: user.email,
                  credits: 0,
                })
                .select("id, first_name, last_name, email, credits")
                .single();

              if (!createError && newStudent) {
                setUserRole("student");
                const fullName = `${newStudent.first_name || ''} ${newStudent.last_name || ''}`.trim();
                setUserName(fullName || user.email);
              } else {
                console.error("Error creating student profile:", createError);
              }
            } else if (userType === 'tutor') {
              // Create tutor profile
              const { data: newTutor, error: createError } = await supabase
                .from("Tutors")
                .insert({
                  user_id: user.id,
                  first_name: userFirstName,
                  last_name: userLastName,
                  email: user.email,
                  subjects: [],
                  application_status: false,
                })
                .select("id, first_name, last_name, email, subjects, application_status")
                .single();

              if (!createError && newTutor) {
                setUserRole("tutor");
                const fullName = `${newTutor.first_name || ''} ${newTutor.last_name || ''}`.trim();
                setUserName(fullName || user.email);
                setTutorId(newTutor.id);
                setTutorApplicationApproved(false);
                setActiveTab("application");
              } else {
                console.error("Error creating tutor profile:", createError);
              }
            }
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

  const studentTabsBase = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "assignments", label: "Assignments", icon: BookOpen },
    { id: "find-tutors", label: "Book Sessions", icon: Search },
    { id: "manage-sessions", label: "Manage Sessions", icon: Clock },
    { id: "meetings", label: "Calendar", icon: Video },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
    { id: "profile", label: "Profile", icon: User },
  ];
  const studentTabs = studentModeEnabled
    ? studentTabsBase // hide Buy Credits
    : [...studentTabsBase, { id: "credits", label: "Buy Credits", icon: Wallet }];

  const tutorTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "assignments", label: "Assignments", icon: BookOpen },
    { id: "calendar", label: "Calendar", icon: CalendarIcon },
    { id: "meetings", label: "Booking Request", icon: Video },
    { id: "past-sessions", label: "Past Sessions", icon: Clock },
    { id: "profile", label: "Profile", icon: User },
  ];

  const tutorApplicationTabs = [
    { id: "application", label: "Application", icon: FileText },
  ];

  // Default admin tabs mapping
  const adminTabsMap = {
    home: { id: "home", label: "Dashboard", icon: Home },
    analytics: { id: "analytics", label: "Analytics", icon: BarChart3 },
    users: { id: "users", label: "Users", icon: Users },
    jobs: { id: "jobs", label: "Jobs", icon: Briefcase },
    services: { id: "services", label: "Services", icon: BookOpen },
    tasks: { id: "tasks", label: "Tasks", icon: CheckSquare },
    subjects: { id: "subjects", label: "Subjects", icon: CheckSquare },
    "credit-plans": { id: "credit-plans", label: "Credit Plans", icon: Wallet },
    announcements: { id: "announcements", label: "Announcements", icon: Megaphone },
    "parents-review": { id: "parents-review", label: "Parents Review", icon: MessageSquare },
    "tutor-applications": {
      id: "tutor-applications",
      label: "Tutor Applications",
      icon: ClipboardList,
    },
  };

  // Build admin tabs from configuration or use defaults
  const getAdminTabs = () => {
    if (userRole === "admin" && adminSidebarConfig.length > 0) {
      // Use configured tabs
      return adminSidebarConfig
        .map((config) => adminTabsMap[config.tab_id])
        .filter(Boolean);
    }
    // Default tabs if no config or superadmin
    return Object.values(adminTabsMap);
  };

  const adminTabs = getAdminTabs();

  // Superadmin tabs - all admin tabs except tasks, plus management tabs
  const superadminTabs = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "jobs", label: "Jobs", icon: Briefcase },
    { id: "services", label: "Services", icon: BookOpen },
    { id: "subjects", label: "Subjects", icon: CheckSquare },
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "parents-review", label: "Parents Review", icon: MessageSquare },
    { id: "credit-plans", label: "Credit Plans", icon: Wallet },
    { id: "sidebar-config", label: "Sidebar Config", icon: Settings },
    { id: "assign-tasks", label: "Assign Tasks", icon: ListTodo },
    { id: "tutor-applications", label: "Tutor Applications", icon: ClipboardList },
  ];

  const resolvedTutorTabs =
    tutorApplicationApproved === null
      ? tutorApplicationTabs
      : tutorApplicationApproved
      ? tutorTabs
      : tutorApplicationTabs;

  const tabs =
    userRole === "student"
      ? (studentModeEnabled
          ? studentTabs
          : [...studentTabs, { id: "review", label: "Review", icon: MessageSquare }])
      : userRole === "tutor"
      ? resolvedTutorTabs
      : userRole === "superadmin"
      ? superadminTabs
      : userRole === "admin"
      ? adminTabs
      : [];

  // Set initial tab for tutors based on application status (only once)
  useEffect(() => {
    if (
      !loading &&
      userRole === "tutor" &&
      tutorApplicationApproved === false &&
      activeTab !== "application"
    ) {
      setActiveTab("application");
    }
  }, [loading, userRole, tutorApplicationApproved]); // Removed activeTab from deps

  // Redirect to home when application is approved (only once)
  useEffect(() => {
    if (
      !loading &&
      userRole === "tutor" &&
      tutorApplicationApproved === true &&
      activeTab === "application"
    ) {
      setActiveTab("home");
    }
  }, [loading, userRole, tutorApplicationApproved]); // Removed activeTab from deps

  // Stable callback for application status change
  const handleApplicationStatusChange = useCallback((status) => {
    setTutorApplicationApproved(status);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

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
            ) : userRole === "superadmin" ? (
              <ShieldCheck className="w-8 h-8 text-red-600" />
            ) : (
              <Shield className="w-8 h-8 text-purple-600" />
            )}
            {sidebarOpen && (
              <span className="font-bold text-gray-900">
                {userRole === "student"
                  ? "Student"
                  : userRole === "tutor"
                  ? "Tutor"
                  : userRole === "superadmin"
                  ? "Super Admin"
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
          {activeTab === "assignments" && userRole === "student" && (
            <StudentAssignments />
          )}
          {activeTab === "home" && userRole === "tutor" && <TutorHome />}
          {activeTab === "assignments" && userRole === "tutor" && (
            <TutorAssignments />
          )}
          {activeTab === "application" && userRole === "tutor" && (
            <TutorApplication
              tutorId={tutorId}
              onApplicationStatusChange={handleApplicationStatusChange}
            />
          )}
          {/* Superadmin tabs */}
          {activeTab === "home" && userRole === "superadmin" && <AdminDashboard />}
          {activeTab === "analytics" && userRole === "superadmin" && (
            <AdminAnalytics />
          )}
          {activeTab === "users" && userRole === "superadmin" && <AdminUsers />}
          {activeTab === "jobs" && userRole === "superadmin" && <AdminJobs />}
          {activeTab === "subjects" && userRole === "superadmin" && (
            <AdminSubjects />
          )}
          {activeTab === "services" && userRole === "superadmin" && (
            <AdminServices />
          )}
          {activeTab === "announcements" && userRole === "superadmin" && (
            <AdminAnnouncements />
          )}
          {activeTab === "parents-review" && userRole === "superadmin" && (
            <AdminParentsReview />
          )}
          {activeTab === "credit-plans" && userRole === "superadmin" && (
            <AdminCreditPlans />
          )}
          {activeTab === "sidebar-config" && userRole === "superadmin" && (
            <SuperadminSidebarConfig onConfigUpdate={loadAdminSidebarConfig} />
          )}
          {activeTab === "assign-tasks" && userRole === "superadmin" && (
            <SuperadminTasks />
          )}
          {activeTab === "tutor-applications" && userRole === "superadmin" && (
            <AdminTutorApplications />
          )}
          {/* Admin tabs */}
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
          {activeTab === "services" && userRole === "admin" && (
            <AdminServices />
          )}
          {activeTab === "announcements" && userRole === "admin" && (
            <AdminAnnouncements />
          )}
          {activeTab === "credit-plans" && userRole === "admin" && (
            <AdminCreditPlans />
          )}
          {activeTab === "tutor-applications" && userRole === "admin" && (
            <AdminTutorApplications />
          )}
          {activeTab === "credits" && userRole === "student" && <Credits />}
          {activeTab === "meetings" && userRole === "student" && <Meetings />}
          {activeTab === "find-tutors" && userRole === "student" && (
            <BookSession />
          )}
          {activeTab === "manage-sessions" && userRole === "student" && (
            <SessionManagement />
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
