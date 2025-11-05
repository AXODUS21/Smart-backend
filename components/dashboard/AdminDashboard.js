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
      const [studentsData, tutorsData, adminsData, bookingsData, schedulesData] = await Promise.all([
        supabase.from("Students").select("id, created_at, credits", { count: "exact" }),
        supabase.from("Tutors").select("id", { count: "exact" }),
        supabase.from("admins").select("id", { count: "exact" }),
        supabase.from("Schedules").select("id, status, credits_required", { count: "exact" }),
        supabase.from("Schedules").select("id, status, credits_required, start_time_utc"),
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
      const pendingBookings = bookings.filter((b) => b.status === "pending").length;
      const confirmedBookings = bookings.filter((b) => b.status === "confirmed").length;

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
        .filter((s) => (parseFloat(s.credits) || 0) < 5 && (parseFloat(s.credits) || 0) > 0)
        .sort((a, b) => (parseFloat(a.credits) || 0) - (parseFloat(b.credits) || 0))
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of platform statistics and recent activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalStudents}</p>
            </div>
            <GraduationCap className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tutors</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalTutors}</p>
            </div>
            <BookOpen className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalBookings}</p>
            </div>
            <Calendar className="w-12 h-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Bookings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingBookings}</p>
            </div>
            <Clock className="w-12 h-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${stats.totalRevenue.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Company Share</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${stats.companyShare.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tutor Earnings</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${stats.tutorEarnings.toFixed(2)}
              </p>
            </div>
            <Users className="w-10 h-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* New Students and Expiring Credits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Newly Enrolled Students */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Newly Enrolled Students (Last 7 Days)
          </h2>
          {newStudents.length === 0 ? (
            <p className="text-gray-500 text-sm">No new students in the last 7 days</p>
          ) : (
            <div className="space-y-3">
              {newStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {student.name || "Unnamed Student"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(student.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {parseFloat(student.credits || 0).toFixed(0)} credits
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Students Nearing Credit Expiration */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Students Nearing Credit Expiration
          </h2>
          {expiringCredits.length === 0 ? (
            <p className="text-gray-500 text-sm">No students with low credits</p>
          ) : (
            <div className="space-y-3">
              {expiringCredits.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {student.name || "Unnamed Student"}
                    </p>
                    <p className="text-sm text-gray-500">{student.email || "No email"}</p>
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

