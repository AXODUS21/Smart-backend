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
          .select("id, created_at, credits", { count: "exact" }),
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
      const newStudentsList = students
        .filter((s) => new Date(s.created_at) >= sevenDaysAgo)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

      // Get students with low credits (less than 5 credits)
      const expiringStudents = students
        .filter(
          (s) =>
            (parseFloat(s.credits) || 0) < 5 && (parseFloat(s.credits) || 0) > 0
        )
        .sort(
          (a, b) => (parseFloat(a.credits) || 0) - (parseFloat(b.credits) || 0)
        )
        .slice(0, 10);

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
            <div className="space-y-3">
              {newStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {student.name || "Unnamed Student"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(student.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {parseFloat(student.credits || 0).toFixed(0)} credits
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
