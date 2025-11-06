"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTutors: 0,
    totalAdmins: 0,
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    totalRevenue: 0,
    tutorEarnings: 0,
    companyShare: 0,
  });
  const [newStudents, setNewStudents] = useState([]);
  const [expiringCredits, setExpiringCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllStudents, setShowAllStudents] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all stats
      const [
        studentsData,
        tutorsData,
        adminsData,
        bookingsData,
        schedulesData,
      ] = await Promise.all([
        supabase
          .from("Students")
          .select("id, name, email, created_at, credits", { count: "exact" }),
        supabase.from("Tutors").select("id", { count: "exact" }),
        supabase.from("admins").select("id", { count: "exact" }),
        supabase
          .from("Schedules")
          .select("id, status, credits_required", { count: "exact" }),
        supabase
          .from("Schedules")
          .select("id, status, credits_required, start_time_utc"),
      ]);

      const students = studentsData.data || [];
      const tutors = tutorsData.data || [];
      const admins = adminsData.data || [];
      const bookings = schedulesData.data || [];

      // Calculate stats
      const totalStudents = studentsData.count || 0;
      const totalTutors = tutorsData.count || 0;
      const totalAdmins = adminsData.count || 0;
      const totalBookings = bookingsData.count || 0;
      const pendingBookings = bookings.filter(
        (b) => b.status === "pending"
      ).length;
      const confirmedBookings = bookings.filter(
        (b) => b.status === "confirmed"
      ).length;

      // Calculate revenue (assuming 1 credit = $10, 70% to tutor, 30% to company)
      const totalCreditsUsed = bookings
        .filter((b) => b.status === "confirmed")
        .reduce((sum, b) => sum + (parseFloat(b.credits_required) || 0), 0);
      const totalRevenue = totalCreditsUsed * 10;
      const tutorEarnings = totalRevenue * 0.7;
      const companyShare = totalRevenue * 0.3;

      // Get newly enrolled students (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();
      const now = new Date();
      
      // Fetch students from the last 7 days using Supabase query
      const { data: newStudentsQuery, error: newStudentsError } = await supabase
        .from("Students")
        .select("id, name, email, created_at, credits")
        .gte("created_at", sevenDaysAgoISO)
        .order("created_at", { ascending: false });

      if (newStudentsError) {
        console.error("Error fetching new students:", newStudentsError);
      }

      // Filter out students older than 7 days (double check)
      const newStudentsList = (newStudentsQuery || []).filter((student) => {
        const createdAt = new Date(student.created_at);
        const daysDiff = (now - createdAt) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      });

      // Get students with low credits (less than 5 credits)
      // Fetch all students with credits to properly filter
      const { data: allStudentsData, error: allStudentsError } = await supabase
        .from("Students")
        .select("id, name, email, credits")
        .gt("credits", 0)
        .lt("credits", 5)
        .order("credits", { ascending: true })
        .limit(10);

      if (allStudentsError) {
        console.error("Error fetching students with low credits:", allStudentsError);
      }

      const expiringStudents = allStudentsData || [];

      setStats({
        totalStudents,
        totalTutors,
        totalAdmins,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        totalRevenue,
        tutorEarnings,
        companyShare,
      });
      setNewStudents(newStudentsList);
      setExpiringCredits(expiringStudents);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const metricData = [
    {
      title: "Total Students",
      value: stats.totalStudents.toString(),
      icon: GraduationCap,
      bgColor: "bg-blue-500",
    },
    {
      title: "Total Tutors",
      value: stats.totalTutors.toString(),
      icon: BookOpen,
      bgColor: "bg-emerald-500",
    },
    {
      title: "Total Bookings",
      value: stats.totalBookings.toString(),
      icon: Calendar,
      bgColor: "bg-purple-500",
    },
    {
      title: "Pending Bookings",
      value: stats.pendingBookings.toString(),
      icon: Clock,
      bgColor: "bg-orange-500",
    },
  ];

  const revenueData = [
    {
      title: "Total Revenue",
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      bgColor: "bg-emerald-500",
    },
    {
      title: "Company Share",
      value: `$${stats.companyShare.toFixed(2)}`,
      icon: TrendingUp,
      bgColor: "bg-blue-500",
    },
    {
      title: "Tutor Earnings",
      value: `$${stats.tutorEarnings.toFixed(2)}`,
      icon: Users,
      bgColor: "bg-purple-500",
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
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Admin Dashboard
        </h2>
        <p className="text-slate-500">
          Overview of platform statistics and recent activity
        </p>
      </div>

      {/* Stats Grid */}
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

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {revenueData.map((metric, index) => {
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
              <p className="text-2xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* New Students and Expiring Credits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Newly Enrolled Students */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Newly Enrolled Students (Last 7 Days)
          </h3>
          {newStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No new students in the last 7 days</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {(showAllStudents ? newStudents : newStudents.slice(0, 5)).map(
                  (student) => {
                    const createdAt = new Date(student.created_at);
                    const daysAgo = Math.floor(
                      (new Date() - createdAt) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {student.name || "Unnamed Student"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {student.email || "No email"}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {daysAgo === 0
                              ? "Today"
                              : daysAgo === 1
                              ? "1 day ago"
                              : `${daysAgo} days ago`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-900">
                            {parseFloat(student.credits || 0).toFixed(0)} credits
                          </p>
                          <p className="text-xs text-slate-400">
                            {createdAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
              {newStudents.length > 5 && (
                <button
                  onClick={() => setShowAllStudents(!showAllStudents)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {showAllStudents ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      View More ({newStudents.length - 5} more)
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Students Nearing Credit Expiration */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Students Nearing Credit Expiration
          </h3>
          {expiringCredits.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No students with low credits</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringCredits.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {student.name || "Unnamed Student"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {student.email || "No email"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600">
                      {parseFloat(student.credits || 0).toFixed(0)} credits
                    </p>
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
