"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileType,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCcw,
  Eye,
  CreditCard,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-300",
  approved: "bg-blue-100 text-blue-700 border-blue-300",
  rejected: "bg-rose-100 text-rose-700 border-rose-300",
  processing: "bg-purple-100 text-purple-700 border-purple-300",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  failed: "bg-red-100 text-red-700 border-red-300",
};

export default function PayoutReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportDetails, setShowReportDetails] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [manualDates, setManualDates] = useState({ start: "", end: "" });

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      setError("");
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired");

      const response = await fetch("/api/superadmin/payout-reports", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load reports");

      setReports(data.reports || []);
    } catch (err) {
      console.error("Error loading reports:", err);
      setError(err.message || "Failed to load payout reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [user]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleGenerateReport = async () => {
    setGenerateLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired");

      if (!manualDates.start || !manualDates.end) {
        throw new Error("Please select both start and end dates.");
      }

      const response = await fetch(`/api/superadmin/payout-stats?start=${manualDates.start}&end=${manualDates.end}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate report");
      
      // Create a temporary report object for display
      const tempReport = {
        id: "PREVIEW",
        report_period_start: manualDates.start,
        report_period_end: manualDates.end,
        generation_date: new Date().toISOString(),
        report_type: "custom_range_preview",
        total_payouts: data.summary.total_payouts,
        total_amount: data.summary.total_amount,
        successful_payouts: data.summary.successful_payouts,
        failed_payouts: data.summary.failed_payouts,
        pending_payouts: data.summary.pending_payouts,
        report_data: {
          withdrawals: data.withdrawals,
          summary: data.summary,
          errors: data.errors || []
        }
      };

      setShowGenerateModal(false);
      setSelectedReport(tempReport);
      setShowReportDetails(true);
      
    } catch (err) {
      console.error("Error generating report:", err);
      setError(err.message || "Failed to generate report");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleProcessPayouts = async () => {
    if (!window.confirm("Are you sure you want to process actual payouts for this date range? This will trigger real financial transactions.")) {
        return;
    }
    
    setGenerateLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired");

      if (!manualDates.start || !manualDates.end) {
        throw new Error("Please select both start and end dates.");
      }

      const response = await fetch(`/api/cron/process-payouts?force=true&startDate=${manualDates.start}&endDate=${manualDates.end}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to process payouts");
      
      alert(data.message || "Payouts processed successfully");
      setShowGenerateModal(false);
      loadReports();
      
    } catch (err) {
      console.error("Error processing payouts:", err);
      setError(err.message || "Failed to process payouts");
    } finally {
      setGenerateLoading(false);
    }
  };

  const exportToExcel = (report) => {
    if (!report || !report.report_data) return;

    try {
      const { withdrawals = [], summary = {} } = report.report_data;
      const wb = XLSX.utils.book_new();

      const uniqueTutors = new Set(withdrawals.map(w => w.tutor_id)).size;

      // Summary data with better formatting
      const summaryData = [
        ["SMART BRAIN PAYOUT REPORT"],
        [`Report Number: ${report.report_number || report.id}`],
        [`Period: ${formatDate(report.report_period_start)} - ${formatDate(report.report_period_end)}`],
        [`Generated: ${formatDateTime(report.generation_date)}`],
        [`Type: ${report.report_type === "automatic_payout" ? "Automatic Payout" : "Manual Payout"}`],
        [],
        ["SUMMARY STATISTICS"],
        ["Total Payouts", summary.total_payouts || 0],
        ["Unique Tutors", uniqueTutors],
        ["Successful", summary.successful_payouts || 0],
        ["Failed", summary.failed_payouts || 0],
        ["Pending", summary.pending_payouts || 0],
        ["Total Amount (PHP)", summary.total_amount_php || summary.total_amount || 0],
        ["Total Amount (USD)", summary.total_amount_usd || 0],
        ["Currency", "PHP / USD"],
        ["Credit Rate", summary.credit_rate || 90],
        ["Total Credits", withdrawals.reduce((sum, w) => sum + (w.credits || 0), 0)],
        [],
        ["TUTORS PAID IN THIS CYCLE"],
        ["Tutor Name", "Region", "Amount", "Credits"],
        ...withdrawals.map(w => {
            const isIntl = w.currency === 'USD' || (w.pricing_region !== 'PH' && w.is_international !== false && w.currency !== 'PHP');
            return [
              w.tutor_name || (w.first_name && w.last_name ? `${w.first_name} ${w.last_name}` : null) || w.tutor_email || "N/A",
              isIntl ? 'International' : 'Philippines',
              isIntl ? `$${parseFloat(w.amount || 0).toFixed(2)} USD` : `PHP ${parseFloat(w.amount || 0).toFixed(2)}`,
              w.credits || 0
            ];
        })
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Basic column widths for summary
      summaryWs["!cols"] = [{ wch: 20 }, { wch: 30 }];
      
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Withdrawals data
      const withdrawalsHeaders = [
        "Withdrawal ID",
        "Tutor Name",
        "Tutor Email",
        "Region",
        "Amount",
        "Credits",
        "Method",
        "Status",
        "Processed At"
      ];

      const withdrawalsRows = withdrawals.map(w => {
        let details = "";
        if (w.payment_method === "bank") {
          details = `${w.bank_name || ""} - ${w.bank_account_number || ""}`;
        } else if (w.payment_method === "gcash") {
          details = `GCash: ${w.gcash_number || ""}`;
        } else if (w.payment_method === "paypal") {
          details = `PayPal: ${w.paypal_email || ""}`;
        } else if (w.payment_method === "stripe" || w.payment_method === "card") {
          details = `Stripe: ${w.stripe_account_id || "Connected"}`;
        }

        // Fallback for tutor name if missing
        const tutorName = w.tutor_name || (w.first_name && w.last_name ? `${w.first_name} ${w.last_name}` : null) || w.tutor_email || "N/A";

        const isIntl = w.currency === 'USD' || (w.pricing_region !== 'PH' && w.is_international !== false && w.currency !== 'PHP');
        return [
          w.withdrawal_id,
          tutorName,
          w.tutor_email || "N/A",
          isIntl ? 'International' : 'Philippines',
          isIntl ? `$${parseFloat(w.amount || 0).toFixed(2)} USD` : parseFloat(w.amount || 0).toFixed(2),
          w.credits || 0,
          w.payment_method?.toUpperCase() || "N/A",
          (w.status || "pending").toUpperCase(),
          w.processed_at ? new Date(w.processed_at).toLocaleString() : "N/A"
        ];
      });

      const withdrawalsWs = XLSX.utils.aoa_to_sheet([withdrawalsHeaders, ...withdrawalsRows]);
      
      // Auto-size columns for withdrawals
      const colWidths = withdrawalsHeaders.map((h, i) => {
        let maxLen = h.length;
        withdrawalsRows.forEach(row => {
          const val = row[i] ? String(row[i]).length : 0;
          if (val > maxLen) maxLen = val;
        });
        return { wch: Math.min(maxLen + 2, 50) };
      });
      withdrawalsWs["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, withdrawalsWs, "Tutor Payouts");

      // Errors sheet
      if (report.report_data.errors && report.report_data.errors.length > 0) {
        const errorsData = [
          ["Tutor ID", "Tutor Name", "Error Message"],
          ...report.report_data.errors.map(e => [
            e.tutor_id || "N/A",
            e.tutor_name || "N/A",
            e.error || "Unknown error"
          ])
        ];
        const errorsWs = XLSX.utils.aoa_to_sheet(errorsData);
        errorsWs["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, errorsWs, "Errors");
      }

      const filename = `SmartBrain_Payout_Report_${report.report_number || report.id}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Failed to export Excel report. Please check the console for details.");
    }
  };

  const exportToPDF = (report) => {
    if (!report || !report.report_data) return;

    try {
      const { withdrawals = [], summary = {} } = report.report_data;
      const doc = new jsPDF();
      
      // Premium Branding Header
      doc.setFillColor(30, 41, 59); // dark slate
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("SMART BRAIN", 15, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("PAYOUT SETTLEMENT REPORT", 15, 30);
      
      doc.setTextColor(255, 255, 255);
      doc.text(`Report Number: #${report.report_number || report.id}`, 195, 22, { align: "right" });
      doc.text(`Generated: ${formatDate(new Date())}`, 195, 30, { align: "right" });

      let yPos = 50;
      
      // Main Info Section
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Report Information", 15, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Period: ${formatDate(report.report_period_start)} to ${formatDate(report.report_period_end)}`, 15, yPos);
      yPos += 6;
      doc.text(`Type: ${report.report_type === "automatic_payout" ? "Scheduled Cycle" : "Manual Distribution"}`, 15, yPos);
      yPos += 15;

      // Summary Stats Dashboard
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Summary", 15, yPos);
      yPos += 8;

      const uniqueTutors = new Set(withdrawals.map(w => w.tutor_id)).size;

      const summaryRows = [
        ["Total Amount (PHP)", `PHP ${parseFloat(summary.total_amount_php || summary.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
        ["Total Amount (USD)", `$${parseFloat(summary.total_amount_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
        ["Total Payout Count", summary.total_payouts || 0],
        ["Unique Tutors Involved", uniqueTutors],
        ["Successful Transactions", summary.successful_payouts || 0],
        ["Failed / Blocked", summary.failed_payouts || 0],
        ["Total Credits Involved", withdrawals.reduce((sum, w) => sum + (w.credits || 0), 0)],
        ["Current Credit Rate", `PHP ${summary.credit_rate || 90.00} / Credit`]
      ];

      autoTable(doc, {
        startY: yPos,
        body: summaryRows,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 }, 1: { cellWidth: 100 } },
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // Withdrawals Table
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Transaction Breakdown", 15, yPos);
      yPos += 6;

      const tableData = withdrawals.map(w => {
        const isIntl = w.currency === 'USD' || (w.pricing_region !== 'PH' && w.is_international !== false && w.currency !== 'PHP');
        const amountStr = isIntl
          ? `$${parseFloat(w.amount || 0).toFixed(2)} USD`
          : `PHP ${parseFloat(w.amount || 0).toFixed(2)}`;
        return [
          w.tutor_name || "N/A",
          w.tutor_email || "N/A",
          amountStr,
          w.credits || 0,
          w.payment_method?.toUpperCase() || "N/A",
          (w.status || "pending").toUpperCase()
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["TUTOR NAME", "EMAIL", "AMOUNT", "CREDITS", "METHOD", "STATUS"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 7 }, // slightly smaller to fit email
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "center" },
          5: { fontStyle: "bold" }
        },
        margin: { top: 10, bottom: 20 }
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Smart Brain Internal Financial Document | Page ${i} of ${pageCount} | Generated at ${formatDateTime(new Date())}`,
          105, 
          285, 
          { align: "center" }
        );
      }

      const filename = `SmartBrain_Payout_Report_${report.id}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Failed to export PDF report. Please check the console for details.");
    }
  };


  const viewReportDetails = (report) => {
    setSelectedReport(report);
    setShowReportDetails(true);
  };

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Payout Reports</h2>
          <p className="text-slate-500 mt-1">
            View and export automatic payout reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadReports}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCcw size={18} />
            Refresh
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <CreditCard size={18} />
            Generate Report
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <FileText className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-600 text-lg">No payout reports found.</p>
          <p className="text-slate-500 text-sm mt-2">
            Reports are automatically generated after each automatic payout processing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="text-blue-600" size={24} />
                    <h3 className="text-lg font-semibold text-slate-900">
                      Payout Report #{report.report_number || report.id}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="text-slate-500" size={18} />
                      <div>
                        <p className="text-xs text-slate-500">Period</p>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDate(report.report_period_start)} - {formatDate(report.report_period_end)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-xs text-slate-500">Total Amount</p>
                        <div className="flex flex-col">
                            <p className="text-sm font-medium text-slate-900">
                            ₱{parseFloat(report.total_amount_php || report.total_amount || 0).toFixed(2)}
                            </p>
                            {(report.total_amount_usd > 0 || (report.report_data?.summary?.total_amount_usd > 0)) && (
                                <p className="text-xs text-slate-600">
                                ${parseFloat(report.total_amount_usd || report.report_data?.summary?.total_amount_usd || 0).toFixed(2)} USD
                                </p>
                            )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="text-blue-600" size={18} />
                      <div>
                        <p className="text-xs text-slate-500">Total Payouts</p>
                        <p className="text-sm font-medium text-slate-900">
                          {report.total_payouts || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-600" size={18} />
                      <div>
                        <p className="text-xs text-slate-500">Successful</p>
                        <p className="text-sm font-medium text-slate-900">
                          {report.successful_payouts || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4">
                    Generated: {formatDateTime(report.generation_date)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => viewReportDetails(report)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    onClick={() => exportToExcel(report)}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                  <button
                    onClick={() => exportToPDF(report)}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    <FileType size={16} />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Details Modal */}
      {showReportDetails && selectedReport && (
        <div className="fixed inset-0 bg-gray-900/80 bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-6">
          <div className="bg-white md:rounded-xl shadow-2xl w-full h-full md:max-h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  Report Details - #{selectedReport.report_number || selectedReport.id}
                </h3>
                <button
                  onClick={() => setShowReportDetails(false)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <ReportDetailsView report={selectedReport} formatDateTime={formatDateTime} formatDate={formatDate} />
            </div>
            <div className="p-6 border-t border-slate-200 flex flex-shrink-0 gap-3 justify-end">
              <button
                onClick={() => exportToExcel(selectedReport)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <FileSpreadsheet size={18} />
                Export to Excel
              </button>
              <button
                onClick={() => exportToPDF(selectedReport)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FileType size={18} />
                Export to PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-gray-900/80 bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Generate Custom Payout Report</h3>
            <p className="text-sm text-slate-600 mb-4">
              Generate a report for a specific custom date range. Standard payouts (15th & 30th) are generated automatically.
            </p>
            
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                        <input 
                            type="date" 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={manualDates.start}
                            onChange={(e) => setManualDates(d => ({...d, start: e.target.value}))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                        <input 
                            type="date" 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={manualDates.end}
                            onChange={(e) => setManualDates(d => ({...d, end: e.target.value}))}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
                <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowGenerateModal(false)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateReport}
                      disabled={generateLoading}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      Preview Only
                    </button>
                    <button
                      onClick={handleProcessPayouts}
                      disabled={generateLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {generateLoading ? "Processing..." : "Process Payouts"}
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest">
                    Caution: "Process Payouts" triggers real transactions
                </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportDetailsView({ report, formatDateTime, formatDate }) {
  const { withdrawals = [], summary = {}, errors = [] } = report.report_data || {};

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="bg-slate-50 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-slate-900 mb-4">Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-slate-600">Total Payouts</p>
            <p className="text-2xl font-bold text-slate-900">{summary.total_payouts || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Successful</p>
            <p className="text-2xl font-bold text-emerald-600">{summary.successful_payouts || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Failed</p>
            <p className="text-2xl font-bold text-red-600">{summary.failed_payouts || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{summary.pending_payouts || 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Total Amount (PHP)</p>
            <p className="text-2xl font-bold text-slate-900">
              ₱{parseFloat(summary.total_amount_php || summary.total_amount || 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Total Amount (USD)</p>
            <p className="text-2xl font-bold text-slate-900">
              ${parseFloat(summary.total_amount_usd || 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Credit Rate</p>
            <p className="text-2xl font-bold text-slate-900">₱{summary.credit_rate || 90}</p>
          </div>
        </div>
      </div>

      {/* Withdrawals List (Card View) */}
      {withdrawals.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-slate-900 mb-4">Individual Payouts</h4>
          <div className="space-y-4">
            {withdrawals.map((w) => {
               // Helper to format payment details
               const getPaymentDetailsCallback = (withdrawal) => {
                 if (withdrawal.payment_method === "bank") {
                   return {
                     method: "Bank Transfer",
                     details: [
                       { label: "Bank", value: withdrawal.bank_name },
                       { label: "Account Name", value: withdrawal.bank_account_name },
                       { label: "Account Number", value: withdrawal.bank_account_number },
                       { label: "Branch", value: withdrawal.bank_branch || "N/A" },
                     ],
                   };
                 } else if (withdrawal.payment_method === "paypal") {
                   return {
                     method: "PayPal",
                     details: [{ label: "Email", value: withdrawal.paypal_email }],
                   };
                 } else if (withdrawal.payment_method === "gcash") {
                   return {
                     method: "GCash",
                     details: [
                       { label: "Account Name", value: withdrawal.gcash_name },
                       { label: "Mobile Number", value: withdrawal.gcash_number },
                     ],
                   };
                 } else if (withdrawal.payment_method === "stripe" || withdrawal.payment_method === "card") {
                    return {
                      method: "Stripe Connect",
                      details: [
                        { label: "Account ID", value: withdrawal.stripe_account_id || "Linked Account" },
                        { label: "Status", value: "Transferred" },
                      ],
                    };
                  }
                  return { method: withdrawal.payment_method || "Unknown", details: [] };
                };

               const paymentDetails = getPaymentDetailsCallback(w);

               return (
                <div
                  key={w.withdrawal_id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {w.tutor_name || "Unknown Tutor"}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[w.status] || STATUS_COLORS.pending}`}
                          >
                            {w.status?.toUpperCase() || "PENDING"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">
                          {w.tutor_email}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-slate-900">
                              {w.currency === 'USD' || (w.pricing_region !== 'PH' && w.is_international !== false && w.currency !== 'PHP')
                              ? `$${parseFloat(w.amount || 0).toFixed(2)} USD`
                              : `₱${parseFloat(w.amount || 0).toFixed(2)}`}
                            </span>
                          </div>
                          <div className="text-sm text-slate-500">
                            Credits: {w.credits}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm text-slate-500">
                         {formatDateTime(w.requested_at)}
                      </div>
                    </div>

                    {/* Payment Information */}
                    {paymentDetails && (
                      <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="text-blue-600" size={18} />
                          <span className="font-medium text-slate-900">
                            {paymentDetails.method}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {paymentDetails.details.map((detail, idx) => (
                            <div key={idx}>
                              <span className="text-slate-600">{detail.label}:</span>{" "}
                              <span className="font-medium text-slate-900">
                                {detail.value || "N/A"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Note if available */}
                    {w.note && (
                        <div className="mt-4 pt-4 border-t border-slate-200 text-sm">
                           <span className="text-slate-600">Note:</span>{" "}
                           <span className="text-slate-900">{w.note}</span>
                        </div>
                    )}
                  </div>
                </div>
               );
            })}
          </div>
        </div>
      )}

      {/* Errors Section */}
      {errors.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
            <AlertCircle size={20} />
            Errors
          </h4>
          <div className="space-y-2">
            {errors.map((error, idx) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-medium text-red-900">
                  {error.tutor_name || `Tutor ID: ${error.tutor_id}`}
                </p>
                <p className="text-sm text-red-700 mt-1">{error.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

