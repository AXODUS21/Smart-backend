"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState({
    totalRevenueUSD: 0,
    totalRevenuePHP: 0,
    companyShareUSD: 0,
    companySharePHP: 0,
    tutorShareUSD: 0,
    tutorSharePHP: 0,
    totalLessonHours: 0,
    totalBookings: 0,
    successfulBookings: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    pendingBookings: 0,
    pendingBookings: 0,
    rejectedBookings: 0,
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    return {
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Fetch Revenue from Transactions
      let transactionQuery = supabase.from("transactions").select("*");
      
      // 2. Fetch Bookings for Expenses/Stats
      let bookingQuery = supabase
        .from("Schedules")
        .select("*, Students(pricing_region), Tutors(region)"); // Fetch Tutor region

      let startTimestamp = null;
      let endTimestamp = null;

      if (dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start + "T00:00:00");
        startTimestamp = startDate.toISOString().slice(0, 19).replace('T', ' ');
        const endDate = new Date(dateRange.end + "T23:59:59");
        endTimestamp = endDate.toISOString().slice(0, 19).replace('T', ' ');

        // Apply filters
        transactionQuery = transactionQuery
          .gte("created_at", startTimestamp)
          .lte("created_at", endTimestamp);

        bookingQuery = bookingQuery
          .gte("start_time_utc", startTimestamp)
          .lte("start_time_utc", endTimestamp);
      }

      const [
        { data: transactions, error: transactionError },
        { data: bookings, error: bookingError }
      ] = await Promise.all([transactionQuery, bookingQuery]);

      if (transactionError) console.error("Error fetching transactions:", transactionError);
      if (bookingError) throw bookingError;

      const safeTransactions = transactions || [];
      const safeBookings = bookings || [];

      console.log(`Found ${safeTransactions.length} transactions and ${safeBookings.length} bookings`);
      
      // --- REVENUE CALCULATION (Cash Basis) ---
      let totalRevenueUSD = 0;
      let totalRevenuePHP = 0;
      
      safeTransactions.forEach(t => {
        let amount = parseFloat(t.amount) || 0;
        // Determine currency - assume lowercase 'usd' or 'php'
        // If currency is missing, default to USD or check transaction source?
        // Let's rely on 'currency' column.
        const currency = (t.currency || 'usd').toLowerCase();
        
        if (currency === 'php') {
          totalRevenuePHP += amount;
        } else {
          totalRevenueUSD += amount;
        }
      });

      // --- EXPENSE CALCULATION (Tutor Pay) ---
      const completedStatuses = ["completed", "successful", "student-no-show"];
      const expenseBookings = safeBookings.filter(b => completedStatuses.includes(b.session_status));

      let totalTutorPayUSD = 0;
      let totalTutorPayPHP = 0;

      expenseBookings.forEach(b => {
        const durationHours = (parseFloat(b.duration_min) || 0) / 60;
        const region = b.Tutors?.region || 'US'; 
        
        if (region === 'PH') {
          // PH Tutor: 180 PHP per hour (2 credits)
          totalTutorPayPHP += durationHours * 180;
        } else {
          // Intl Tutor: $3 USD per hour (2 credits)
          totalTutorPayUSD += durationHours * 3;
        }
      });

      // --- NET PROFIT (Company Share) ---
      const companyShareUSD = totalRevenueUSD - totalTutorPayUSD;
      const companySharePHP = totalRevenuePHP - totalTutorPayPHP;

      // --- BOOKING STATS ---
      const pendingStatuses = ["pending", "awaiting_approval"];
      const confirmedStatuses = ["confirmed"];
      const cancelledStatuses = ["cancelled", "tutor-no-show", "rescheduled"];
      const rejectedStatuses = ["rejected"];

      const pendingCounts = safeBookings.filter(b => pendingStatuses.includes(b.status));
      const confirmedCounts = safeBookings.filter(b => confirmedStatuses.includes(b.status));
      const successfulCounts = safeBookings.filter(b => b.session_status === "successful");
      const cancelledCounts = safeBookings.filter(b => cancelledStatuses.includes(b.status));
      const rejectedCounts = safeBookings.filter(b => rejectedStatuses.includes(b.status));

      const totalLessonHours = safeBookings.reduce(
        (sum, b) => {
            if (b.session_status === 'successful') {
                return sum + (parseFloat(b.duration_min) || 0) / 60;
            }
            return sum;
        },
        0
      );

      // --- MONTHLY BREAKDOWN ---
      const monthlyMap = {};

      // Process Transactions
      safeTransactions.forEach(t => {
        const date = new Date(t.created_at);
        const month = date.toLocaleString("default", { month: "short", year: "numeric" });
        
        if (!monthlyMap[month]) {
            monthlyMap[month] = { 
              month, 
              revenueUSD: 0, 
              revenuePHP: 0, 
              hours: 0, 
              successfulBookings: 0,
              totalBookings: 0
            };
        }

        let amount = parseFloat(t.amount) || 0;
        const currency = (t.currency || 'usd').toLowerCase();
        
        if (currency === 'php') {
          monthlyMap[month].revenuePHP += amount;
        } else {
          monthlyMap[month].revenueUSD += amount;
        }
      });

      // Process Bookings for Hours and Counts
      safeBookings.forEach(b => {
        const date = new Date(b.start_time_utc);
        const month = date.toLocaleString("default", { month: "short", year: "numeric" });
        
        if (!monthlyMap[month]) {
            monthlyMap[month] = { 
              month, 
              revenueUSD: 0, 
              revenuePHP: 0, 
              hours: 0, 
              successfulBookings: 0,
              totalBookings: 0
            };
        }

        monthlyMap[month].totalBookings += 1;

        if (b.session_status === 'successful') {
            monthlyMap[month].hours += (parseFloat(b.duration_min) || 0) / 60;
            monthlyMap[month].successfulBookings += 1;
        }
      });

      // Sort monthly data
      const sortedMonthlyData = Object.values(monthlyMap).sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateB - dateA;
      });

      setMonthlyData(sortedMonthlyData);
      setAnalytics({
        totalRevenueUSD,
        totalRevenuePHP,
        companyShareUSD, // Net Profit USD
        companySharePHP, // Net Profit PHP
        tutorShareUSD: totalTutorPayUSD,
        tutorSharePHP: totalTutorPayPHP,
        totalLessonHours,
        totalBookings: safeBookings.length,
        successfulBookings: successfulCounts.length,
        confirmedBookings: confirmedCounts.length,
        cancelledBookings: cancelledCounts.length,
        pendingBookings: pendingCounts.length,
        rejectedBookings: rejectedCounts.length,
      });

    } catch (error) {
      console.error("Error fetching analytics:", error);
      // Set default values on error
      setAnalytics({
        totalRevenueUSD: 0,
        totalRevenuePHP: 0,
        companyShareUSD: 0,
        companySharePHP: 0,
        tutorShareUSD: 0,
        tutorSharePHP: 0,
        totalLessonHours: 0,
        totalBookings: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        pendingBookings: 0,
        rejectedBookings: 0,
      });
      setMonthlyData([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Metric",
      "Value (USD)",
      "Value (PHP)",
      "Date Range",
      `${dateRange.start} to ${dateRange.end}`,
    ];
    const rows = [
      ["Total Revenue", `$${analytics.totalRevenueUSD.toFixed(2)}`, `₱${analytics.totalRevenuePHP.toFixed(2)}`],
      ["Net Profit", `$${analytics.companyShareUSD.toFixed(2)}`, `₱${analytics.companySharePHP.toFixed(2)}`],
      ["Tutor Pay", `$${analytics.tutorShareUSD.toFixed(2)}`, `₱${analytics.tutorSharePHP.toFixed(2)}`],
      ["Total Lesson Hours", `${analytics.totalLessonHours.toFixed(2)}`, "-"],
      ["Total Bookings", analytics.totalBookings, "-"],
      ["Successful Bookings", analytics.successfulBookings, "-"],
      ["Confirmed Bookings", analytics.confirmedBookings, "-"],
      ["Cancelled Bookings", analytics.cancelledBookings, "-"],
      ["Pending Bookings", analytics.pendingBookings, "-"],
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `analytics_${dateRange.start}_to_${dateRange.end}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    try {
      const pdfContainer = document.createElement("div");
      pdfContainer.style.position = "absolute";
      pdfContainer.style.left = "-9999px";
      pdfContainer.style.width = "800px";
      pdfContainer.style.padding = "40px";
      pdfContainer.style.backgroundColor = "#ffffff";
      pdfContainer.style.fontFamily = "Arial, sans-serif";

      const htmlContent = `
        <div style="margin-bottom: 30px;">
          <h1 style="color: #1e293b; font-size: 28px; margin-bottom: 10px;">Analytics Report</h1>
          <p style="color: #64748b; font-size: 14px;">Date Range: ${
            dateRange.start
          } to ${dateRange.end}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 15px;">Key Metrics</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f8fafc;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Metric</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">USD</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">PHP</th>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Total Revenue</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">$${analytics.totalRevenueUSD.toFixed(2)}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">₱${analytics.totalRevenuePHP.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Net Profit</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">$${analytics.companyShareUSD.toFixed(2)}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">₱${analytics.companySharePHP.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Tutor Pay</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">$${analytics.tutorShareUSD.toFixed(2)}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">₱${analytics.tutorSharePHP.toFixed(2)}</td>
            </tr>
          </table>
          
          <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 15px; margin-top: 30px;">Operational Stats</h2>
          <table style="width: 100%; border-collapse: collapse;">
             <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Total Lesson Hours</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${analytics.totalLessonHours.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Total Bookings</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${
                analytics.totalBookings
              }</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Successful Bookings</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${
                analytics.successfulBookings
              }</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Confirmed Bookings</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${
                analytics.confirmedBookings
              }</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">Pending Bookings</td>
              <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${
                analytics.pendingBookings
              }</td>
            </tr>
          </table>
        </div>
        
        ${
          monthlyData.length > 0
            ? `
        <div>
          <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 15px;">Monthly Breakdown</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f8fafc;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Month</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Revenue (USD)</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Revenue (PHP)</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Hours</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Successful Bookings</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">Total Bookings</th>
            </tr>
            ${monthlyData
              .map(
                (m) =>
                  `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${
                      m.month
                    }</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">$${m.revenueUSD.toFixed(2)}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">₱${m.revenuePHP.toFixed(2)}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${m.hours.toFixed(2)}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${
                      m.successfulBookings
                    }</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${
                      m.totalBookings
                    }</td>
                  </tr>`
              )
              .join("")}
          </table>
        </div>
        `
            : ""
        }
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center;">
          Generated on ${new Date().toLocaleString()}
        </div>
      `;

      pdfContainer.innerHTML = htmlContent;
      document.body.appendChild(pdfContainer);

      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(pdfContainer);

      const imgWidth = 210;
      const pageHeight = 297; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const pdf = new jsPDF("p", "mm", "a4");
      let position = 0;

      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      pdf.save(`analytics_${dateRange.start}_to_${dateRange.end}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const metricData = [
    {
      title: "Revenue (USD)",
      value: `$${analytics.totalRevenueUSD.toFixed(2)}`,
      icon: DollarSign,
      bgColor: "bg-emerald-600",
    },
    {
      title: "Revenue (PHP)",
      value: `₱${analytics.totalRevenuePHP.toFixed(2)}`,
      icon: DollarSign,
      bgColor: "bg-emerald-500",
    },
    {
      title: "Net Profit (USD)",
      value: `$${analytics.companyShareUSD.toFixed(2)}`,
      icon: TrendingUp,
      bgColor: "bg-blue-600",
    },
    {
      title: "Net Profit (PHP)",
      value: `₱${analytics.companySharePHP.toFixed(2)}`,
      icon: TrendingUp,
      bgColor: "bg-blue-500",
    },
    {
      title: "Tutor Pay (USD)",
      value: `$${analytics.tutorShareUSD.toFixed(2)}`,
      icon: DollarSign,
      bgColor: "bg-purple-600",
    },
    {
      title: "Tutor Pay (PHP)",
      value: `₱${analytics.tutorSharePHP.toFixed(2)}`,
      icon: DollarSign,
      bgColor: "bg-purple-500",
    },
    {
      title: "Lesson Hours",
      value: analytics.totalLessonHours.toFixed(2),
      icon: Calendar,
      bgColor: "bg-orange-500",
    },
    {
      title: "Successful Bookings",
      value: analytics.successfulBookings,
      icon: Calendar,
      bgColor: "bg-slate-500",
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Analytics & Reports
          </h2>
          <p className="text-slate-500">
            Income breakdowns, lesson hours, and statistics
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/60 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Export Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/60 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Date Range
        </h3>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="border border-slate-300 rounded-lg px-4 py-2 text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="border border-slate-300 rounded-lg px-4 py-2 text-slate-900"
            />
          </div>
          <button
            onClick={() => {
              // Set to last 12 months
              const endDate = new Date();
              const startDate = new Date();
              startDate.setMonth(startDate.getMonth() - 12);
              setDateRange({
                start: startDate.toISOString().split("T")[0],
                end: endDate.toISOString().split("T")[0],
              });
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Last 12 Months
          </button>
          <button
            onClick={() => {
              // Set to all time (no date filter)
              const endDate = new Date();
              endDate.setFullYear(endDate.getFullYear() + 10); // Far future
              const startDate = new Date();
              startDate.setFullYear(startDate.getFullYear() - 10); // Far past
              setDateRange({
                start: startDate.toISOString().split("T")[0],
                end: endDate.toISOString().split("T")[0],
              });
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            All Time
          </button>
        </div>
      </div>

      {/* Key Metrics */}
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
              <p className="text-2xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* Booking Statistics */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Booking Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 bg-slate-100 rounded-lg border border-slate-300">
            <p className="text-sm font-medium text-slate-600">Total (All)</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {analytics.totalBookings}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm font-medium text-slate-600">Successful</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {analytics.successfulBookings}
            </p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm font-medium text-slate-600">Pending</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {analytics.pendingBookings}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-slate-600">Confirmed</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {analytics.confirmedBookings}
            </p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-slate-600">Cancelled</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {analytics.cancelledBookings}
            </p>
          </div>
          <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
            <p className="text-sm font-medium text-slate-600">Rejected</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {analytics.rejectedBookings}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Monthly Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Revenue (USD)
                  </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Revenue (PHP)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Successful
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {monthlyData.map((month, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {month.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      ${month.revenueUSD.toFixed(2)}
                    </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      ₱{month.revenuePHP.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {month.hours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {month.successfulBookings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {month.totalBookings}
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
