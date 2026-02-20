"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCcw,
  DollarSign,
  CreditCard,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  FileType,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-300",
  approved: "bg-blue-100 text-blue-700 border-blue-300",
  rejected: "bg-rose-100 text-rose-700 border-rose-300",
  processing: "bg-purple-100 text-purple-700 border-purple-300",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  failed: "bg-red-100 text-red-700 border-red-300",
};

export default function SuperadminWithdrawals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rejectionReason, setRejectionReason] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const loadWithdrawals = async () => {
    if (!user) return;
    setError("");
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");

      const res = await fetch("/api/superadmin/withdrawals/list", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to retrieve withdrawal requests.");

      setWithdrawals(json.withdrawals || []);
    } catch (fetchErr) {
      console.error("Failed to load withdrawals:", fetchErr);
      setError(fetchErr.message || "Failed to retrieve withdrawal requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, [user]);

  const handleApprove = async (withdrawal) => {
    if (!user) return;
    setError("");
    setSuccess("");
    setActioningId(withdrawal.id);

    try {
      // First approve the withdrawal
      const approveResponse = await fetch("/api/admin/withdrawals/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          withdrawalId: withdrawal.id,
          action: "approve",
          superadminId: user.id,
        }),
      });

      if (!approveResponse.ok) {
        const approveData = await approveResponse.json();
        throw new Error(approveData.error || "Failed to approve withdrawal");
      }

      // Then automatically process the approved withdrawal
      const processResponse = await fetch("/api/admin/withdrawals/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          withdrawalId: withdrawal.id,
          superadminId: user.id,
        }),
      });

      const processData = await processResponse.json();

      if (!processResponse.ok) {
        // Approval succeeded but processing failed
        setError(
          `Withdrawal approved but processing failed: ${processData.error || "Unknown error"}`
        );
      } else {
        setSuccess(
          `Withdrawal approved and payment processing initiated! Transaction ID: ${processData.transactionId || "N/A"}`
        );
      }

      await loadWithdrawals();
    } catch (actionError) {
      console.error("Failed to approve withdrawal:", actionError);
      setError(actionError.message || "An error occurred while approving the withdrawal.");
    } finally {
      setActioningId(null);
      setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
    }
  };

  const handleReject = async (withdrawal) => {
    if (!user) return;
    const reason = rejectionReason[withdrawal.id]?.trim();

    if (!reason) {
      setError("Please provide a reason for rejection.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setError("");
    setSuccess("");
    setActioningId(withdrawal.id);

    try {
      const response = await fetch("/api/admin/withdrawals/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          withdrawalId: withdrawal.id,
          action: "reject",
          superadminId: user.id,
          rejectionReason: reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject withdrawal");
      }

      setSuccess("Withdrawal rejected successfully.");
      await loadWithdrawals();
      setRejectionReason((prev) => ({
        ...prev,
        [withdrawal.id]: "",
      }));
    } catch (actionError) {
      console.error("Failed to reject withdrawal:", actionError);
      setError(actionError.message || "An error occurred while rejecting the withdrawal.");
    } finally {
      setActioningId(null);
      setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
    }
  };

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((withdrawal) => {
      const matchesStatus =
        filterStatus === "all" || withdrawal.status === filterStatus;
      const matchesSearch =
        !searchTerm ||
        withdrawal.tutor?.first_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        withdrawal.tutor?.last_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        withdrawal.tutor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.amount?.toString().includes(searchTerm);
      return matchesStatus && matchesSearch;
    });
  }, [withdrawals, filterStatus, searchTerm]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPaymentDetails = (tutor) => {
    if (!tutor) return { method: "Unknown", details: [] };
    
    // Handle array response from Supabase join
    const tutorData = Array.isArray(tutor) ? tutor[0] : tutor;
    
    if (tutorData.payment_method === "bank") {
      return {
        method: "Bank Transfer",
        details: [
          { label: "Bank", value: tutorData.bank_name },
          { label: "Account Name", value: tutorData.bank_account_name },
          { label: "Account Number", value: tutorData.bank_account_number },
          { label: "Branch", value: tutorData.bank_branch || "N/A" },
        ],
      };
    } else if (tutorData.payment_method === "paypal") {
      return {
        method: "PayPal",
        details: [{ label: "Email", value: tutorData.paypal_email }],
      };
    } else if (tutorData.payment_method === "gcash") {
      return {
        method: "GCash",
        details: [
          { label: "Account Name", value: tutorData.gcash_name },
          { label: "Mobile Number", value: tutorData.gcash_number },
        ],
      };
    }
    return { method: "Unknown", details: [] };
  };

  // Format amount based on tutor's region
  const formatAmount = (tutor, amount) => {
    const tutorData = Array.isArray(tutor) ? tutor[0] : tutor;
    const isInternational = tutorData?.pricing_region !== 'PH';
    const value = parseFloat(amount || 0);
    if (isInternational) {
      return `$${value.toFixed(2)} USD`;
    }
    return `₱${value.toFixed(2)}`;
  };

  const isInternationalTutor = (tutor) => {
    const tutorData = Array.isArray(tutor) ? tutor[0] : tutor;
    return tutorData?.pricing_region !== 'PH';
  };

  const exportToExcel = () => {
    if (!filteredWithdrawals.length) return;

    const exportData = filteredWithdrawals.map((w) => {
      // Handle Supabase join - tutor might be an object or array
      const tutorRaw = w.tutor;
      const tutor = Array.isArray(tutorRaw) ? tutorRaw[0] : tutorRaw;
      const paymentDetails = getPaymentDetails(tutor);
      
      const paymentInfo = paymentDetails.details
        .map(d => `${d.label}: ${d.value}`)
        .join("; ");

      return {
        "Request ID": w.id,
        "Tutor Name": tutor ? `${tutor.first_name || ""} ${tutor.last_name || ""}`.trim() : "Unknown",
        "Tutor Email": tutor?.email || "N/A",
        "Region": tutor?.pricing_region === 'PH' ? 'Philippines' : 'International',
        [tutor?.pricing_region === 'PH' ? "Amount (PHP)" : "Amount (USD)"]: parseFloat(w.amount || 0).toFixed(2),
        "Status": w.status || "pending",
        "Requested Date": formatDate(w.requested_at),
        "Processed Date": w.processed_at ? formatDate(w.processed_at) : "N/A",
        "Payment Method": paymentDetails.method,
        "Payment Details": paymentInfo,
        "Transaction ID": w.payout_transaction_id || "N/A",
        "Note": w.note || ""
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Add some column widths
    const wscols = [
      { wch: 10 }, // ID
      { wch: 20 }, // Name
      { wch: 25 }, // Email
      { wch: 15 }, // Amount
      { wch: 12 }, // Status
      { wch: 20 }, // Requested
      { wch: 20 }, // Processed
      { wch: 15 }, // Method
      { wch: 40 }, // Details
      { wch: 20 }, // Tx ID
      { wch: 30 }, // Note
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Withdrawals");
    XLSX.writeFile(wb, `Withdrawals_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (!filteredWithdrawals.length) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("Withdrawal Requests Report", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Status Filter: ${filterStatus.toUpperCase()}`, 14, 35);
    
    if (searchTerm) {
      doc.text(`Search Term: "${searchTerm}"`, 14, 40);
    }

    const tableData = filteredWithdrawals.map((w) => {
      const tutorRaw = w.tutor;
      const tutor = Array.isArray(tutorRaw) ? tutorRaw[0] : tutorRaw;
      const paymentDetails = getPaymentDetails(tutor);

      return [
         w.id,
         tutor ? `${tutor.first_name || ""} ${tutor.last_name || ""}`.trim() : "Unknown",
         parseFloat(w.amount || 0).toFixed(2),
         w.status || "pending",
         formatDate(w.requested_at),
         paymentDetails.method,
      ];
    });

    doc.autoTable({
      startY: 45,
      head: [["ID", "Tutor", "Amount", "Status", "Requested", "Method"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save(`Withdrawals_Export_${new Date().toISOString().split('T')[0]}.pdf`);
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
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Payout Approvals
        </h2>
        <p className="text-slate-500 mt-1">
          Review and approve/reject payouts
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search by tutor name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
            <button
              onClick={loadWithdrawals}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RefreshCcw size={18} />
              Refresh
            </button>
            <button
              onClick={exportToExcel}
              disabled={filteredWithdrawals.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              disabled={filteredWithdrawals.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileType size={18} />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Withdrawals List */}
      <div className="space-y-4">
        {filteredWithdrawals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <Clock className="mx-auto text-slate-400 mb-4" size={48} />
            <p className="text-slate-600 text-lg">
              No withdrawal requests found.
            </p>
          </div>
        ) : (
          filteredWithdrawals.map((withdrawal) => {
            // Handle Supabase join - tutor might be an object or array
            const tutorRaw = withdrawal.tutor;
            const tutor = Array.isArray(tutorRaw) ? tutorRaw[0] : tutorRaw;
            
            const tutorName = tutor
              ? `${tutor.first_name || ""} ${tutor.last_name || ""}`.trim() ||
                tutor.email ||
                "Unknown Tutor"
              : "Unknown Tutor";
            const paymentDetails = tutor ? getPaymentDetails(tutor) : null;
            const isExpanded = expandedId === withdrawal.id;
            const isActioning = actioningId === withdrawal.id;

            return (
              <div
                key={withdrawal.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {tutorName}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[withdrawal.status] || STATUS_COLORS.pending}`}
                        >
                          {withdrawal.status?.toUpperCase() || "PENDING"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">
                        {tutor?.email}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="text-emerald-600" size={18} />
                          <span className="text-xl font-bold text-slate-900">
                            {formatAmount(tutor, withdrawal.amount)}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500">
                          Requested: {formatDate(withdrawal.requested_at)}
                        </div>
                      </div>
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

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-sm">
                      <div>
                        <span className="text-slate-600">Request ID:</span>{" "}
                        <span className="font-mono text-slate-900">
                          {withdrawal.id}
                        </span>
                      </div>
                      {withdrawal.note && (
                        <div>
                          <span className="text-slate-600">Note:</span>{" "}
                          <span className="text-slate-900">{withdrawal.note}</span>
                        </div>
                      )}
                      {withdrawal.approved_at && (
                        <div>
                          <span className="text-slate-600">Approved:</span>{" "}
                          <span className="text-slate-900">
                            {formatDate(withdrawal.approved_at)}
                          </span>
                        </div>
                      )}
                      {withdrawal.rejected_at && (
                        <div>
                          <span className="text-slate-600">Rejected:</span>{" "}
                          <span className="text-slate-900">
                            {formatDate(withdrawal.rejected_at)}
                          </span>
                          {withdrawal.rejection_reason && (
                            <div className="mt-1">
                              <span className="text-slate-600">Reason:</span>{" "}
                              <span className="text-red-700">
                                {withdrawal.rejection_reason}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {withdrawal.processed_at && (
                        <div>
                          <span className="text-slate-600">Processed:</span>{" "}
                          <span className="text-slate-900">
                            {formatDate(withdrawal.processed_at)}
                          </span>
                        </div>
                      )}
                      {withdrawal.payout_provider && (
                        <div>
                          <span className="text-slate-600">Provider:</span>{" "}
                          <span className="text-slate-900">
                            {withdrawal.payout_provider}
                          </span>
                        </div>
                      )}
                      {withdrawal.payout_transaction_id && (
                        <div>
                          <span className="text-slate-600">Transaction ID:</span>{" "}
                          <span className="font-mono text-slate-900">
                            {withdrawal.payout_transaction_id}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {withdrawal.status === "pending" && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(withdrawal)}
                          disabled={isActioning}
                          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isActioning ? (
                            <>
                              <Loader2 className="animate-spin" size={18} />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} />
                              Approve & Process
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : withdrawal.id)}
                          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                        >
                          {isExpanded ? "Less" : "More"}
                        </button>
                      </div>
                      <div className="space-y-2">
                        <textarea
                          value={rejectionReason[withdrawal.id] || ""}
                          onChange={(e) =>
                            setRejectionReason((prev) => ({
                              ...prev,
                              [withdrawal.id]: e.target.value,
                            }))
                          }
                          placeholder="Rejection reason (required)"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 text-sm"
                          rows={2}
                        />
                        <button
                          onClick={() => handleReject(withdrawal)}
                          disabled={isActioning || !rejectionReason[withdrawal.id]?.trim()}
                          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <XCircle size={18} />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/* View Details Button for non-pending */}
                  {withdrawal.status !== "pending" && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : withdrawal.id)}
                      className="mt-4 w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-1">Pending</div>
          <div className="text-2xl font-bold text-amber-600">
            {withdrawals.filter((w) => w.status === "pending").length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-1">Total Amount</div>
          <div className="text-2xl font-bold text-slate-900">
            ₱
            {withdrawals
              .filter((w) => w.status === "pending" || w.status === "approved")
              .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0)
              .toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-1">Completed</div>
          <div className="text-2xl font-bold text-emerald-600">
            {withdrawals.filter((w) => w.status === "completed").length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-1">Rejected</div>
          <div className="text-2xl font-bold text-red-600">
            {withdrawals.filter((w) => w.status === "rejected").length}
          </div>
        </div>
      </div>
    </div>
  );
}


