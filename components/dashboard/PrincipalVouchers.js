"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Ticket, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
};

export default function PrincipalVouchers() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      const res = await fetch("/api/vouchers/my", {
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter a voucher code.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");
      const res = await fetch("/api/vouchers/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to submit voucher");
      setSuccess("Voucher submitted. Waiting for admin approval.");
      setCode("");
      await loadRequests();
    } catch (e) {
      setError(e.message || "Failed to submit voucher");
    } finally {
      setSubmitting(false);
    }
  };

  const rows = useMemo(() => requests || [], [requests]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Vouchers</h2>
        <p className="text-slate-600 text-sm">
          Submit voucher codes. Admins will approve or reject your request.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-600" />
            <div className="font-semibold text-slate-900">Submit a voucher</div>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter voucher code"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && <div className="text-sm text-green-700">{success}</div>}
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="font-semibold text-slate-900">My voucher requests</div>
          <div className="text-sm text-slate-500">Latest first</div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-slate-500">No voucher requests yet.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.map((r) => {
              const status = r.status || "pending";
              const Icon =
                status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
              return (
                <div key={r.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 break-all">{r.code}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Submitted: {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}
                      {r.decided_at ? (
                        <>
                          {" "}
                          • Decided: {new Date(r.decided_at).toLocaleString()}
                        </>
                      ) : null}
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
                    className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {status}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

