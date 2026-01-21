"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, Loader2, RefreshCcw } from "lucide-react";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700 border-amber-300",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-300",
  rejected: "bg-rose-100 text-rose-700 border-rose-300",
};

export default function AdminVoucherRequests() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creditsInput, setCreditsInput] = useState({});
  const [reasonInput, setReasonInput] = useState({});
  const [actioningId, setActioningId] = useState(null);

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const loadRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");
      const res = await fetch("/api/admin/vouchers/list", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load voucher requests");
      setRequests(payload.requests || []);
    } catch (e) {
      setError(e.message || "Failed to load voucher requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const list = requests || [];
    if (!filterStatus) return list;
    return list.filter((r) => (r.status || "pending") === filterStatus);
  }, [requests, filterStatus]);

  const process = async (id, action) => {
    setError("");
    setSuccess("");
    setActioningId(id);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");

      const creditsAmount = Number(creditsInput[id] || 0);
      const reason = (reasonInput[id] || "").toString();

      const res = await fetch("/api/admin/vouchers/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: id,
          action,
          creditsAmount,
          reason,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to process request");
      setSuccess("Updated voucher request.");
      await loadRequests();
    } catch (e) {
      setError(e.message || "Failed to process request");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Voucher Requests</h2>
          <p className="text-slate-600 text-sm">
            Approve or reject voucher submissions from principals.
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-700">{success}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="font-semibold text-slate-900">Requests</div>
          <div>
            <label className="text-sm text-slate-600 mr-2">Filter</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-slate-500">No requests.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filtered.map((r) => {
              const status = r.status || "pending";
              return (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 break-all">{r.code}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Principal user: {r.principal_user_id}
                        {" • "}
                        Submitted: {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}
                      </div>
                      {r.decision_reason ? (
                        <div className="text-xs text-slate-600 mt-1">
                          Reason: {r.decision_reason}
                        </div>
                      ) : null}
                      {status === "approved" ? (
                        <div className="text-xs text-emerald-700 mt-1">
                          Credits added: {r.credits_amount}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className={`shrink-0 px-2 py-1 rounded-full text-xs border ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}
                    >
                      {status}
                    </div>
                  </div>

                  {status === "pending" ? (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Credits to add (on approve)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={creditsInput[r.id] ?? ""}
                          onChange={(e) =>
                            setCreditsInput((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="e.g. 10"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-600 mb-1">
                          Reason / notes (optional)
                        </label>
                        <input
                          value={reasonInput[r.id] ?? ""}
                          onChange={(e) =>
                            setReasonInput((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="md:col-span-3 flex gap-2">
                        <button
                          onClick={() => process(r.id, "approve")}
                          disabled={actioningId === r.id}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => process(r.id, "reject")}
                          disabled={actioningId === r.id}
                          className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

