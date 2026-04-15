"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, RefreshCw, CheckCircle } from "lucide-react";

function formatMoney(amount, currency) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "—";
  if ((currency || "").toLowerCase() === "php") return `₱${n.toFixed(2)}`;
  if ((currency || "").toLowerCase() === "usd") return `$${n.toFixed(2)}`;
  return `${n.toFixed(2)} ${currency || ""}`.trim();
}

export default function AdminManualTopups() {
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "100");
    return params.toString();
  }, [status, q]);

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/admin/manual-topups/list?${queryString}`, {
        headers: {
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load requests");
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const approve = async (requestId) => {
    setApprovingId(requestId);
    setError("");
    setNotice("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/admin/manual-topups/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      setNotice(
        `Approved ${data.addedCredits} credits. New balance: ${data.newCredits} credits.`
      );
      await fetchRequests();
    } catch (e) {
      setError(e.message || "Failed to approve");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Manual Top-up Requests (GCash)
        </h2>
        <p className="text-slate-500">
          Students submit a reference code, then send receipt/proof via Facebook
          Messenger for manual verification.
        </p>
      </div>

      <div className="bg-white rounded-lg p-4 border border-slate-200 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex gap-2 items-center">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by reference code…"
            className="w-full md:w-80 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
          />
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>

          <button
            onClick={fetchRequests}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 text-sm text-slate-600">
          {loading
            ? "Loading…"
            : `${requests.length} request${requests.length === 1 ? "" : "s"}`}
        </div>

        <div className="divide-y divide-slate-200">
          {!loading && requests.length === 0 ? (
            <div className="p-6 text-slate-500">No requests found.</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {r.reference_code}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {r.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {r.student?.name ? (
                        <span className="font-medium text-slate-800">
                          {r.student.name}
                        </span>
                      ) : (
                        <span className="text-slate-500">Unknown student</span>
                      )}
                      {r.student?.email ? (
                        <span className="text-slate-500">
                          {" "}
                          · {r.student.email}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      <span className="font-medium text-slate-800">
                        {r.credits} credits
                      </span>
                      <span className="text-slate-500">
                        {" "}
                        · {formatMoney(r.amount, r.currency)}
                      </span>
                      {r.plan_name ? (
                        <span className="text-slate-500"> · {r.plan_name}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Submitted:{" "}
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {r.status === "pending" && (
                      <button
                        onClick={() => approve(r.id)}
                        disabled={approvingId === r.id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:bg-emerald-400"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {approvingId === r.id ? "Approving…" : "Approve & add credits"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

