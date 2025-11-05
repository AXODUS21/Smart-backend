"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Download, FileSpreadsheet, FileText, Calendar, TrendingUp, DollarSign } from "lucide-react";

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    companyShare: 0,
    tutorShare: 0,
    totalLessonHours: 0,
    totalBookings: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    pendingBookings: 0,
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      // Fetch all bookings in date range
      const { data: bookings, error } = await supabase
        .from("Schedules")
        .select("*")
        .gte("start_time_utc", dateRange.start)
        .lte("end_time_utc", dateRange.end);

      if (error) throw error;

      const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
      const totalLessonHours = confirmedBookings.reduce(
        (sum, b) => sum + (parseFloat(b.duration_min) || 0) / 60,
        0
      );

      // Calculate revenue (1 credit = $10, 70% tutor, 30% company)
      const totalCredits = confirmedBookings.reduce(
        (sum, b) => sum + (parseFloat(b.credits_required) || 0),
        0
      );
      const totalRevenue = totalCredits * 10;
      const tutorShare = totalRevenue * 0.7;
      const companyShare = totalRevenue * 0.3;

      // Calculate monthly breakdown
      const monthlyMap = {};
      confirmedBookings.forEach((booking) => {
        const month = new Date(booking.start_time_utc).toLocaleString("default", {
          month: "short",
          year: "numeric",
        });
        if (!monthlyMap[month]) {
          monthlyMap[month] = {
            month,
            revenue: 0,
            hours: 0,
            bookings: 0,
          };
        }
        monthlyMap[month].revenue += (parseFloat(booking.credits_required) || 0) * 10;
        monthlyMap[month].hours += (parseFloat(booking.duration_min) || 0) / 60;
        monthlyMap[month].bookings += 1;
      });

      setMonthlyData(Object.values(monthlyMap));
      setAnalytics({
        totalRevenue,
        companyShare,
        tutorShare,
        totalLessonHours,
        totalBookings: bookings.length,
        confirmedBookings: confirmedBookings.length,
        cancelledBookings: bookings.filter((b) => b.status === "cancelled").length,
        pendingBookings: bookings.filter((b) => b.status === "pending").length,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Metric",
      "Value",
      "Date Range",
      `${dateRange.start} to ${dateRange.end}`,
    ];
    const rows = [
      ["Total Revenue", `$${analytics.totalRevenue.toFixed(2)}`],
      ["Company Share", `$${analytics.companyShare.toFixed(2)}`],
      ["Tutor Share", `$${analytics.tutorShare.toFixed(2)}`],
      ["Total Lesson Hours", `${analytics.totalLessonHours.toFixed(2)}`],
      ["Total Bookings", analytics.totalBookings],
      ["Confirmed Bookings", analytics.confirmedBookings],
      ["Cancelled Bookings", analytics.cancelledBookings],
      ["Pending Bookings", analytics.pendingBookings],
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics_${dateRange.start}_to_${dateRange.end}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    // Create HTML content for PDF
    const htmlContent = `
      <html>
        <head>
          <title>Analytics Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Analytics Report</h1>
          <p>Date Range: ${dateRange.start} to ${dateRange.end}</p>
          <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Revenue</td><td>$${analytics.totalRevenue.toFixed(2)}</td></tr>
            <tr><td>Company Share</td><td>$${analytics.companyShare.toFixed(2)}</td></tr>
            <tr><td>Tutor Share</td><td>$${analytics.tutorShare.toFixed(2)}</td></tr>
            <tr><td>Total Lesson Hours</td><td>${analytics.totalLessonHours.toFixed(2)}</td></tr>
            <tr><td>Total Bookings</td><td>${analytics.totalBookings}</td></tr>
            <tr><td>Confirmed Bookings</td><td>${analytics.confirmedBookings}</td></tr>
            <tr><td>Cancelled Bookings</td><td>${analytics.cancelledBookings}</td></tr>
            <tr><td>Pending Bookings</td><td>${analytics.pendingBookings}</td></tr>
          </table>
          <h2>Monthly Breakdown</h2>
          <table>
            <tr><th>Month</th><th>Revenue</th><th>Hours</th><th>Bookings</th></tr>
            ${monthlyData
              .map(
                (m) =>
                  `<tr><td>${m.month}</td><td>$${m.revenue.toFixed(2)}</td><td>${m.hours.toFixed(2)}</td><td>${m.bookings}</td></tr>`
              )
              .join("")}
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Income breakdowns, lesson hours, and statistics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Export Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h2>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${analytics.totalRevenue.toFixed(2)}
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
                ${analytics.companyShare.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tutor Share</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${analytics.tutorShare.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lesson Hours</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {analytics.totalLessonHours.toFixed(2)}
              </p>
            </div>
            <Calendar className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Booking Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Total Bookings</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.totalBookings}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Confirmed</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.confirmedBookings}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Cancelled</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.cancelledBookings}</p>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bookings
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyData.map((month, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {month.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${month.revenue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {month.hours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {month.bookings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

