"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Briefcase, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";

export default function AdminJobs() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("Schedules")
        .select(
          `
          *,
          student:student_id (
            id,
            name,
            email
          ),
          tutor:tutor_id (
            id,
            name,
            email
          )
        `
        )
        .order("start_time_utc", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        color: "bg-yellow-100 text-yellow-800",
        icon: <Clock className="w-4 h-4" />,
        label: "Pending",
      },
      confirmed: {
        color: "bg-green-100 text-green-800",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Confirmed",
      },
      cancelled: {
        color: "bg-red-100 text-red-800",
        icon: <XCircle className="w-4 h-4" />,
        label: "Cancelled",
      },
      completed: {
        color: "bg-blue-100 text-blue-800",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Completed",
      },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      icon: <AlertCircle className="w-4 h-4" />,
      label: status || "Unknown",
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  };

  const filteredBookings = () => {
    let filtered = bookings;

    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (b) =>
          b.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.student?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.tutor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.tutor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.subject?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getStatusStats = () => {
    return {
      all: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      completed: bookings.filter((b) => b.status === "completed").length,
    };
  };

  const stats = getStatusStats();

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
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Jobs (Bookings)</h2>
        <p className="text-slate-500">View all bookings with status indicators</p>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div
          onClick={() => setStatusFilter("all")}
          className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer transition-all ${
            statusFilter === "all" ? "ring-2 ring-blue-500" : ""
          }`}
        >
          <p className="text-sm font-medium text-slate-600">All</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.all}</p>
        </div>
        <div
          onClick={() => setStatusFilter("pending")}
          className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer transition-all ${
            statusFilter === "pending" ? "ring-2 ring-yellow-500" : ""
          }`}
        >
          <p className="text-sm font-medium text-slate-600">Pending</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.pending}</p>
        </div>
        <div
          onClick={() => setStatusFilter("confirmed")}
          className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer transition-all ${
            statusFilter === "confirmed" ? "ring-2 ring-green-500" : ""
          }`}
        >
          <p className="text-sm font-medium text-slate-600">Confirmed</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.confirmed}</p>
        </div>
        <div
          onClick={() => setStatusFilter("cancelled")}
          className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer transition-all ${
            statusFilter === "cancelled" ? "ring-2 ring-red-500" : ""
          }`}
        >
          <p className="text-sm font-medium text-slate-600">Cancelled</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.cancelled}</p>
        </div>
        <div
          onClick={() => setStatusFilter("completed")}
          className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer transition-all ${
            statusFilter === "completed" ? "ring-2 ring-blue-500" : ""
          }`}
        >
          <p className="text-sm font-medium text-slate-600">Completed</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.completed}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by student, tutor, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Booking ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tutor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredBookings().map((booking) => (
                <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    #{booking.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">
                      {booking.student?.name || "Unknown"}
                    </div>
                    <div className="text-sm text-slate-500">{booking.student?.email || ""}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{booking.tutor?.name || "Unknown"}</div>
                    <div className="text-sm text-slate-500">{booking.tutor?.email || ""}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {booking.subject || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">
                      {new Date(booking.start_time_utc).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-slate-500">
                      {new Date(booking.start_time_utc).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {parseFloat(booking.duration_min || 0)} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {parseFloat(booking.credits_required || 0).toFixed(0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(booking.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBookings().length === 0 && (
            <div className="text-center py-12 text-slate-500">No bookings found</div>
          )}
        </div>
      </div>
    </div>
  );
}

