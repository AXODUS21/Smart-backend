"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Briefcase, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Search, Filter, X, FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function AdminJobs() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [tutorFilter, setTutorFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [minDurationFilter, setMinDurationFilter] = useState("");
  const [maxDurationFilter, setMaxDurationFilter] = useState("");
  const [minCreditsFilter, setMinCreditsFilter] = useState("");
  const [maxCreditsFilter, setMaxCreditsFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, student, tutor, subject, date, status
  const [sortDirection, setSortDirection] = useState("desc"); // asc, desc

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
            first_name,
            last_name,
            email
          ),
          tutor:tutor_id (
            id,
            id,
            name,
            first_name,
            last_name,
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
      awaiting_approval: {
        color: "bg-yellow-100 text-yellow-800",
        icon: <Clock className="w-4 h-4" />,
        label: "Awaiting Approval",
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
      "tutor-no-show": {
        color: "bg-red-100 text-red-800",
        icon: <XCircle className="w-4 h-4" />,
        label: "Tutor No-Show",
      },
      rescheduled: {
        color: "bg-red-100 text-red-800",
        icon: <Clock className="w-4 h-4" />,
        label: "Rescheduled",
      },
      completed: {
        color: "bg-blue-100 text-blue-800",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Completed",
      },
      successful: {
        color: "bg-blue-100 text-blue-800",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Successful",
      },
      "student-no-show": {
        color: "bg-blue-100 text-blue-800",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Student No-Show",
      },
      rejected: {
        color: "bg-rose-100 text-rose-800",
        icon: <XCircle className="w-4 h-4" />,
        label: "Rejected",
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

    // Status filter
    if (statusFilter !== "all") {
      const statusMap = {
        pending: ["pending", "awaiting_approval"],
        confirmed: ["confirmed"],
        cancelled: ["cancelled", "tutor-no-show", "rescheduled"],
        rejected: ["rejected"],
      };
      const allowed = statusMap[statusFilter] || [statusFilter];
      filtered = filtered.filter((b) => allowed.includes(b.status));
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (b) =>
          getStudentDisplayName(b).toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.student?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          getTutorDisplayName(b.tutor).toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.tutor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.subject?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Subject filter
    if (subjectFilter) {
      filtered = filtered.filter((b) => b.subject?.toLowerCase() === subjectFilter.toLowerCase());
    }

    // Tutor filter
    if (tutorFilter) {
      filtered = filtered.filter((b) => {
        const t = b.tutor;
        if (!t) return false;
        let n = `${t.first_name || ""} ${t.last_name || ""}`.trim();
        if (!n) n = t.name || "";
        const displayName = n.trim() || t.email || "";
        return displayName.toLowerCase().includes(tutorFilter.toLowerCase());
      });
    }

    // Student filter
    if (studentFilter) {
      filtered = filtered.filter((b) => {
        const name = getStudentDisplayName(b);
        return name.toLowerCase().includes(studentFilter.toLowerCase());
      });
    }

    // Date range filter
    if (startDateFilter) {
      const startDate = new Date(startDateFilter + "T00:00:00");
      filtered = filtered.filter((b) => {
        const bookingDate = new Date(b.start_time_utc);
        return bookingDate >= startDate;
      });
    }

    if (endDateFilter) {
      const endDate = new Date(endDateFilter + "T23:59:59.999");
      filtered = filtered.filter((b) => {
        const bookingDate = new Date(b.start_time_utc);
        return bookingDate <= endDate;
      });
    }

    // Duration filter
    if (minDurationFilter) {
      const minDuration = parseFloat(minDurationFilter);
      filtered = filtered.filter((b) => parseFloat(b.duration_min || 0) >= minDuration);
    }

    if (maxDurationFilter) {
      const maxDuration = parseFloat(maxDurationFilter);
      filtered = filtered.filter((b) => parseFloat(b.duration_min || 0) <= maxDuration);
    }

    // Credits filter
    if (minCreditsFilter) {
      const minCredits = parseFloat(minCreditsFilter);
      filtered = filtered.filter((b) => parseFloat(b.credits_required || 0) >= minCredits);
    }

    if (maxCreditsFilter) {
      const maxCredits = parseFloat(maxCreditsFilter);
      filtered = filtered.filter((b) => parseFloat(b.credits_required || 0) <= maxCredits);
    }

    // Sort bookings
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "newest":
        case "oldest":
          aValue = new Date(a.start_time_utc || 0).getTime();
          bValue = new Date(b.start_time_utc || 0).getTime();
          break;
        case "student":
          aValue = getStudentDisplayName(a).toLowerCase();
          bValue = getStudentDisplayName(b).toLowerCase();
          break;
        case "tutor":
          aValue = getTutorDisplayName(a.tutor).toLowerCase();
          bValue = getTutorDisplayName(b.tutor).toLowerCase();
          break;
        case "subject":
          aValue = (a.subject || "").toLowerCase();
          bValue = (b.subject || "").toLowerCase();
          break;
        case "date":
          aValue = new Date(a.start_time_utc || 0).getTime();
          bValue = new Date(b.start_time_utc || 0).getTime();
          break;
        case "status":
          const statusOrder = { 
            pending: 0, awaiting_approval: 0,
            confirmed: 1, 
            completed: 2, successful: 2, "student-no-show": 2,
            cancelled: 3, "tutor-no-show": 3, rescheduled: 3,
            rejected: 4 
          };
          aValue = statusOrder[a.status] ?? 5;
          bValue = statusOrder[b.status] ?? 5;
          break;
        case "credits":
          aValue = parseFloat(a.credits_required || 0);
          bValue = parseFloat(b.credits_required || 0);
          break;
        case "duration":
          aValue = parseFloat(a.duration_min || 0);
          bValue = parseFloat(b.duration_min || 0);
          break;
        default:
          aValue = new Date(a.start_time_utc || 0).getTime();
          bValue = new Date(b.start_time_utc || 0).getTime();
      }

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      // Handle numeric/date comparison
      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  };

  const getStatusStats = () => {
    return {
      all: bookings.length,
      pending: bookings.filter((b) => ["pending", "awaiting_approval"].includes(b.status)).length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      cancelled: bookings.filter((b) => ["cancelled", "tutor-no-show", "rescheduled"].includes(b.status)).length,
      rejected: bookings.filter((b) => b.status === "rejected").length,
    };
  };

  const getUniqueSubjects = () => {
    const subjects = bookings
      .map((b) => b.subject)
      .filter((s) => s && s.trim() !== "")
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
    return subjects;
  };

  const getTutorDisplayName = (t) => {
    if (!t) return "Unknown";
    let n = `${t.first_name || ""} ${t.last_name || ""}`.trim();
    if (!n) n = t.name || "";
    // If name is still empty, or looks exactly like an email, fallback to Unknown
    if (!n.trim() || n.trim() === t.email) return "Unknown";
    return n.trim();
  };

  const getStudentDisplayName = (booking) => {
    if (!booking) return "Unknown";
    const s = booking.student;
    
    // 1. Try profile_name from Schedules table first (most specific)
    if (booking.profile_name && booking.profile_name.trim()) {
      return booking.profile_name.trim();
    }
    
    if (!s) return "Unknown";
    
    // 2. Try Students.name
    if (s.name && s.name.trim()) return s.name.trim();
    
    // 3. Try Students.first_name + last_name
    let n = `${s.first_name || ""} ${s.last_name || ""}`.trim();
    if (n) return n;
    
    // 4. Fallback to email if name is missing
    if (s.email) return s.email;
    
    return "Unknown";
  };

  const getUniqueTutors = () => {
    const tutors = bookings
      .map((b) => getTutorDisplayName(b.tutor))
      .filter((name) => name && name !== "Unknown")
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));
    return tutors;
  };

  const getUniqueStudents = () => {
    const students = bookings
      .map((b) => getStudentDisplayName(b))
      .filter((name) => name && name.trim() !== "" && name !== "Unknown")
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));
    return students;
  };

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
    setSubjectFilter("");
    setTutorFilter("");
    setStudentFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setMinDurationFilter("");
    setMaxDurationFilter("");
    setMinCreditsFilter("");
    setMaxCreditsFilter("");
    setSortBy("newest");
    setSortDirection("desc");
  };

  const hasActiveFilters = () => {
    return (
      statusFilter !== "all" ||
      searchTerm ||
      subjectFilter ||
      tutorFilter ||
      studentFilter ||
      startDateFilter ||
      endDateFilter ||
      minDurationFilter ||
      maxDurationFilter ||
      minCreditsFilter ||
      maxCreditsFilter ||
      sortBy !== "newest" ||
      sortDirection !== "desc"
    );
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

      {/* Export Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const dataToExport = filteredBookings().map(b => ({
              "Booking ID": b.id,
              "Student Name": getStudentDisplayName(b),
              "Student Email": b.student?.email || "",
              "Tutor Name": getTutorDisplayName(b.tutor),
              "Tutor Email": b.tutor?.email || "",
              "Subject": b.subject || "N/A",
              "Date": new Date(b.start_time_utc).toLocaleDateString(),
              "Time": new Date(b.start_time_utc).toLocaleTimeString(),
              "Duration (min)": parseFloat(b.duration_min || 0),
              "Credits": parseFloat(b.credits_required || 0),
              "Status": b.status
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Bookings");
            XLSX.writeFile(wb, `bookings_export_${new Date().toISOString().split('T')[0]}.xlsx`);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Excel
        </button>
        <button
          onClick={() => {
            const doc = new jsPDF();
            
            // Add title
            doc.setFontSize(18);
            doc.text("Job Bookings Report", 14, 22);
            doc.setFontSize(11);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

            const tableColumn = ["ID", "Student", "Tutor", "Subject", "Date", "Time", "Status"];
            const tableRows = filteredBookings().map(b => [
              b.id,
              getStudentDisplayName(b),
              getTutorDisplayName(b.tutor),
              b.subject || "N/A",
              new Date(b.start_time_utc).toLocaleDateString(),
              new Date(b.start_time_utc).toLocaleTimeString(),
              b.status
            ]);

            autoTable(doc, {
              head: [tableColumn],
              body: tableRows,
              startY: 40,
              theme: 'grid',
              styles: { fontSize: 8 },
              headStyles: { fillColor: [41, 128, 185] }
            });

            doc.save(`bookings_export_${new Date().toISOString().split('T')[0]}.pdf`);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div
          onClick={() => setStatusFilter("all")}
          className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer transition-all lg:col-span-2 ${
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
          onClick={() => setStatusFilter("rejected")}
          className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 cursor-pointer transition-all ${
            statusFilter === "rejected" ? "ring-2 ring-rose-500" : ""
          }`}
        >
          <p className="text-sm font-medium text-slate-600">Rejected</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.rejected}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by student, tutor, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
              showFilters || hasActiveFilters()
                ? "bg-blue-50 border-blue-500 text-blue-700"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters() && (
              <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                Active
              </span>
            )}
          </button>
          {hasActiveFilters() && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 text-sm"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="subject">Sort: By Subject</option>
              <option value="status">Sort: By Status</option>
              <option value="credits">Sort: By Credits</option>
            </select>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 text-sm"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Subject Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                >
                  <option value="">All Subjects</option>
                  {getUniqueSubjects().map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tutor Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tutor</label>
                <select
                  value={tutorFilter}
                  onChange={(e) => setTutorFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                >
                  <option value="">All Tutors</option>
                  {getUniqueTutors().map((tutorName, index) => (
                    <option key={index} value={tutorName}>
                      {tutorName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Student</label>
                <select
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                >
                  <option value="">All Students</option>
                  {getUniqueStudents().map((studentName, index) => (
                    <option key={index} value={studentName}>
                      {studentName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                />
              </div>

              {/* End Date Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                />
              </div>

              {/* Duration Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Duration (minutes)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minDurationFilter}
                    onChange={(e) => setMinDurationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                    min="0"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxDurationFilter}
                    onChange={(e) => setMaxDurationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                    min="0"
                  />
                </div>
              </div>

              {/* Credits Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Credits</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minCreditsFilter}
                    onChange={(e) => setMinCreditsFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                    min="0"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxCreditsFilter}
                    onChange={(e) => setMaxCreditsFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
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
                      {getStudentDisplayName(booking)}
                    </div>
                    <div className="text-sm text-slate-500">{booking.student?.email || ""}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{getTutorDisplayName(booking.tutor)}</div>
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

