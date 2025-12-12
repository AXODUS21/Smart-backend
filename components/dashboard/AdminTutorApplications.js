"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export default function AdminTutorApplications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState({});

  const loadApplications = useCallback(async () => {
    if (!user) return;
    setError("");
    setRefreshing(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("TutorApplications")
        .select(
          `
          id,
          tutor_id,
          user_id,
          full_name,
          email,
          phone,
          experience,
          qualifications,
          subjects,
          resume_url,
          status,
          notes,
          submitted_at,
          reviewed_at,
          reviewed_by,
          tutor:Tutors(id, name, email, application_status)
        `
        )
        .order("submitted_at", { ascending: false });

      if (fetchError) throw fetchError;

      setApplications(data || []);
    } catch (fetchErr) {
      console.error("Failed to load tutor applications:", fetchErr);
      setError(fetchErr.message || "Failed to retrieve tutor applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleDecision = async (application, status) => {
    if (!user) return;
    setError("");
    setActioningId(application.id);
    try {
      const notes = decisionNotes[application.id]?.trim() || null;

      const { error: updateTutorError } = await supabase
        .from("Tutors")
        .update({ application_status: status === "approved" })
        .eq("id", application.tutor_id);

      if (updateTutorError) throw updateTutorError;

      const { error: updateApplicationError } = await supabase
        .from("TutorApplications")
        .update({
          status,
          notes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", application.id);

      if (updateApplicationError) throw updateApplicationError;

      // Send tutor application approval notification
      try {
        const { notifyTutorApplicationApproval } = await import('@/lib/notificationService');
        await notifyTutorApplicationApproval(
          application.email,
          application.full_name,
          application.id,
          status
        );
        console.log('Tutor application approval notification sent');
      } catch (notifError) {
        console.error('Failed to send tutor application approval notification:', notifError);
        // Don't fail approval if notification fails
      }

      await loadApplications();
      setDecisionNotes((prev) => ({
        ...prev,
        [application.id]: "",
      }));
    } catch (actionError) {
      console.error("Failed to update tutor application:", actionError);
      setError(actionError.message || "An error occurred while updating the application.");
    } finally {
      setActioningId(null);
    }
  };

  const handleDownloadResume = async (application) => {
    if (!application.resume_url) return;
    const { data, error: signedUrlError } = await supabase.storage
      .from("assignments")
      .createSignedUrl(application.resume_url, 60 * 10);

    if (signedUrlError) {
      console.error("Failed to create signed URL:", signedUrlError);
      setError("Unable to generate resume link. Please try again.");
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => {
      const matchesStatus =
        filterStatus === "all" ? true : application.status === filterStatus;
      const matchesSearch = searchTerm
        ? [application.full_name, application.email, application.tutor?.name, application.tutor?.email]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [applications, filterStatus, searchTerm]);

  const renderStatusBadge = (status) => {
    const color = STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
    const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${color}`}
      >
        <Icon className="h-4 w-4" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 flex items-center justify-center shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading tutor applications...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Tutor Applications
            </h2>
            <p className="text-slate-500 mt-1">
              Review, approve, or deny tutor applications submitted through the platform.
            </p>
          </div>
          <button
            onClick={loadApplications}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {["pending", "approved", "rejected", "all"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filterStatus === status
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search tutors..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center text-slate-500">
            No tutor applications found for this filter.
          </div>
        ) : (
          filteredApplications.map((application) => (
            <div
              key={application.id}
              className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-3">
                    {application.full_name || "Unnamed Applicant"}
                    {renderStatusBadge(application.status)}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {application.email}
                    {application.phone ? ` • ${application.phone}` : ""}
                  </p>
                  {application.tutor?.name && (
                    <p className="text-xs text-slate-400 mt-1">
                      Tutor record: {application.tutor.name} ({application.tutor.email})
                    </p>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  <p>
                    Submitted:{" "}
                    {new Date(application.submitted_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {application.reviewed_at && (
                    <p>
                      Reviewed:{" "}
                      {new Date(application.reviewed_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>

              {application.subjects && application.subjects.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {application.subjects.map((subject) => (
                    <span
                      key={subject}
                      className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-700">Experience</h4>
                  <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
                    {application.experience || "Not provided."}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-700">Qualifications</h4>
                  <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
                    {application.qualifications || "Not provided."}
                  </p>
                </div>
              </div>

              {application.notes && application.status !== "pending" && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                  <span className="font-semibold">Reviewer Notes: </span>
                  {application.notes}
                </div>
              )}

              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <textarea
                  rows={3}
                  value={decisionNotes[application.id] ?? application.notes ?? ""}
                  onChange={(event) =>
                    setDecisionNotes((prev) => ({
                      ...prev,
                      [application.id]: event.target.value,
                    }))
                  }
                  placeholder="Add reviewer notes or feedback for this tutor..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 md:w-1/2"
                />
                <div className="flex flex-col gap-3 md:items-end">
                  <button
                    type="button"
                    onClick={() => handleDownloadResume(application)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4" />
                    View Resume
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleDecision(application, "rejected")}
                      disabled={actioningId === application.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {actioningId === application.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Deny
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(application, "approved")}
                      disabled={actioningId === application.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {actioningId === application.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

