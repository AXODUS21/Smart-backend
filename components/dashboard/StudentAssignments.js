"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PROFILE_ID, getActiveProfile } from "@/lib/studentProfiles";
import {
  BookOpen,
  Calendar,
  FileText,
  Upload,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Send,
} from "lucide-react";

export default function StudentAssignments({ overrideStudentId }) {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState({});
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("status"); // status=priority default
  const [searchTerm, setSearchTerm] = useState("");
  const activeProfile = useMemo(() => {
    if (!studentRecord) return null;
    return getActiveProfile(studentRecord);
  }, [studentRecord]);

  // Get student's bigint ID
  useEffect(() => {
    const fetchStudentId = async () => {
      if (!user && !overrideStudentId) return;

      let studentData = null;
      if (overrideStudentId) {
        const { data } = await supabase
          .from("Students")
          .select("id, first_name, last_name, extra_profiles, active_profile_id")
          .eq("id", overrideStudentId)
          .single();
        studentData = data;
      } else {
        const { data } = await supabase
          .from("Students")
          .select("id, first_name, last_name, extra_profiles, active_profile_id")
          .eq("user_id", user.id)
          .single();
        studentData = data;
      }

      if (studentData) {
        setStudentId(studentData.id);
        setStudentRecord(studentData);
      }
    };

    fetchStudentId();
  }, [user, overrideStudentId]);

  // Fetch assignments
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!studentId) return;
      const profileIdFilter = studentRecord?.active_profile_id || DEFAULT_PROFILE_ID;

      try {
        const { data, error } = await supabase
          .from("Assignments")
          .select(
            `
            *,
            tutor:tutor_id (
              id,
              name,
              email
            )
          `
          )
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Mark overdue assignments
        const now = new Date();
        const updatedAssignments = (data || []).map((assignment) => {
          if (
            assignment.due_date &&
            new Date(assignment.due_date) < now &&
            assignment.status === "assigned" &&
            !assignment.submission_file_url
          ) {
            return { ...assignment, status: "overdue" };
          }
          return assignment;
        });

        const filteredAssignments = updatedAssignments.filter((assignment) => {
          if (!assignment.profile_id) return true;
          return assignment.profile_id === profileIdFilter;
        });

        setAssignments(filteredAssignments);
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [studentId, studentRecord]);

  // Handle submission
  const handleSubmitAssignment = async (assignmentId) => {
    setSubmitting((prev) => ({ ...prev, [assignmentId]: true }));
    setError("");
    setSuccess("");

    try {
      if (!submissionFile) {
        setError("Please select a file to submit.");
        setSubmitting((prev) => ({ ...prev, [assignmentId]: false }));
        return;
      }

      // Sanitize filename
      const sanitizedFileName = submissionFile.name
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/\s+/g, '_');
      
      // Upload file to Supabase storage
      const filePath = `submissions/${studentId}_${assignmentId}_${Date.now()}_${sanitizedFileName}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from("assignments")
        .upload(filePath, submissionFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) {
        throw new Error("File upload failed: " + storageError.message + ". Please ensure the storage bucket 'assignments' exists and has proper permissions.");
      }

      // Get public URL
      const { data } = supabase.storage
        .from("assignments")
        .getPublicUrl(filePath);
      const fileUrl = data?.publicUrl || filePath;

      // Update assignment with submission
      const { error: updateError } = await supabase
        .from("Assignments")
        .update({
          submission_file_url: fileUrl,
          submission_date: new Date().toISOString(),
          submission_notes: submissionNotes || null,
          status: "submitted",
        })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      setSuccess("Assignment submitted successfully!");
      setSelectedAssignment(null);
      setSubmissionFile(null);
      setSubmissionNotes("");

      // Refresh assignments
      const { data: updatedData } = await supabase
        .from("Assignments")
        .select(
          `
          *,
          tutor:tutor_id (
            id,
            name,
            email
          )
        `
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      const profileIdFilter = studentRecord?.active_profile_id || DEFAULT_PROFILE_ID;
      const filteredData = (updatedData || []).filter((assignment) => {
        if (!assignment.profile_id) return true;
        return assignment.profile_id === profileIdFilter;
      });

      setAssignments(filteredData);
    } catch (error) {
      console.error("Error submitting assignment:", error);
      setError(error.message || "Failed to submit assignment.");
    } finally {
      setSubmitting((prev) => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Get status badge
  const getStatusBadge = (assignment) => {
    const status = assignment.status;
    const styles = {
      assigned: "bg-blue-100 text-blue-800",
      submitted: "bg-yellow-100 text-yellow-800",
      graded: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          styles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "No due date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if assignment is overdue
  const isOverdue = (assignment) => {
    if (!assignment.due_date || assignment.status !== "assigned") return false;
    return new Date(assignment.due_date) < new Date();
  };

  // Filter assignments
  const filteredAssignments = assignments
    .filter((assignment) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        assignment.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.tutor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.tutor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.subject?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== "all") {
        if (statusFilter === "overdue") {
          matchesStatus = isOverdue(assignment);
        } else {
          matchesStatus = assignment.status === statusFilter;
        }
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at) - new Date(a.created_at);
        case "oldest":
          return new Date(a.created_at) - new Date(b.created_at);
        case "tutor": {
          const ta = (a.tutor?.name || a.tutor?.email || "").toLowerCase();
          const tb = (b.tutor?.name || b.tutor?.email || "").toLowerCase();
          return ta.localeCompare(tb);
        }
        case "dueDate":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        case "status": {
          const order = { submitted: 0, assigned: 1, graded: 2, overdue: 3 };
          return (order[a.status] ?? 4) - (order[b.status] ?? 4);
        }
        case "submittedDate":
          if (!a.submission_date && !b.submission_date) return 0;
          if (!a.submission_date) return 1;
          if (!b.submission_date) return -1;
          return new Date(b.submission_date) - new Date(a.submission_date);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-64 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            My Assignments
          </h2>
          <p className="text-sm text-slate-500">
            View and submit your assignments
          </p>
          {activeProfile && (
            <p className="text-xs text-slate-500 mt-1">
              Viewing assignments for <span className="font-medium">{activeProfile.name}</span>. Change active profile in Student Settings.
            </p>
          )}
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Assignments</option>
            <option value="assigned">Assigned</option>
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Assignments List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-3 border-b border-slate-200">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search assignments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="submitted">Need Grading</option>
                  <option value="assigned">Assigned</option>
                  <option value="graded">Graded</option>
                  <option value="overdue">Overdue</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="status">Sort: Priority</option>
                  <option value="submittedDate">Sort: Newest Submissions</option>
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="tutor">Sort: Tutor</option>
                  <option value="dueDate">Sort: Due Date</option>
                </select>
              </div>
            </div>
            {filteredAssignments.length > 0 && (
              <div className="text-xs text-slate-500">
                Showing {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredAssignments.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-base font-medium">No assignments found</p>
              <p className="text-xs">
                {assignments.length === 0 ? "You don't have any assignments yet." : "Try adjusting your filter criteria."}
              </p>
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Info horizontal line */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900">{assignment.title}</h3>
                      {getStatusBadge(assignment)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                      <span className="font-medium">Tutor:</span>
                      <span className="truncate">{assignment.tutor?.name || assignment.tutor?.email || 'Unknown'}</span>
                      {assignment.subject && <><span className="text-slate-400">•</span><BookOpen className="w-3 h-3 flex-shrink-0" /><span className="truncate">{assignment.subject}</span></>}<span className="text-slate-400">•</span><Calendar className="w-3 h-3 flex-shrink-0" /><span className="truncate">Due: {formatDate(assignment.due_date)}</span>{assignment.max_points && <><span className="text-slate-400">•</span><span className="font-medium">Points:</span><span>{assignment.points !== null && assignment.points !== undefined ? `${assignment.points}` : 'Not graded'}{assignment.max_points && ` / ${assignment.max_points}`}</span></>}
                      {assignment.profile_name && (
                        <>
                          <span className="text-slate-400">•</span>
                          <span className="font-medium">Profile:</span>
                          <span>{assignment.profile_name}</span>
                        </>
                      )}
                    </div>
                    {assignment.description && (
                      <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap line-clamp-2">{assignment.description}</p>
                    )}
                    {/* Tutor attachment */}
                    {assignment.file_url && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-1 text-blue-800 mb-1">
                          <FileText className="w-3 h-3" />
                          <span className="font-medium text-xs">Tutor Attachment</span>
                        </div>
                        <a
                          href={assignment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:underline text-blue-800 text-xs"
                        >
                          <Download className="w-3 h-3" />
                          Download Assignment File
                        </a>
                      </div>
                    )}
                    {/* Submission/graded info */}
                    {assignment.submission_file_url && (
                      <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-1 text-green-800 mb-1">
                          <CheckCircle className="w-3 h-3" />
                          <span className="font-medium text-xs">Submitted</span>
                        </div>
                        <div className="text-xs text-green-700 space-y-0.5">
                          <div>Submitted: {formatDate(assignment.submission_date)}</div>
                          <a href={assignment.submission_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline text-green-800"><Download className="w-3 h-3" />View Submission</a>
                          {assignment.submission_notes && (<div className="mt-1"><span className="font-medium">Notes:</span> <span>{assignment.submission_notes}</span></div>)}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Action button */}
                  {assignment.status === 'assigned' && !assignment.submission_file_url && (
                    <button
                      onClick={() => setSelectedAssignment(assignment)}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Submission Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  Submit Assignment
                </h3>
                <button
                  onClick={() => {
                    setSelectedAssignment(null);
                    setSubmissionFile(null);
                    setSubmissionNotes("");
                    setError("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-3">
                <h4 className="font-medium text-sm text-slate-900 mb-1">
                  {selectedAssignment.title}
                </h4>
                {selectedAssignment.description && (
                  <p className="text-xs text-slate-600 mb-1">
                    {selectedAssignment.description}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Due: {formatDate(selectedAssignment.due_date)}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitAssignment(selectedAssignment.id);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Upload File <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors text-sm">
                      <Upload className="w-4 h-4" />
                      <span>Choose File</span>
                      <input
                        type="file"
                        onChange={(e) =>
                          setSubmissionFile(e.target.files?.[0] || null)
                        }
                        className="hidden"
                        required
                      />
                    </label>
                    {submissionFile && (
                      <span className="text-xs text-slate-600 truncate max-w-xs">
                        {submissionFile.name}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes or comments about your submission..."
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="submit"
                    disabled={submitting[selectedAssignment.id] || !submissionFile}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <Send className="w-4 h-4" />
                    {submitting[selectedAssignment.id]
                      ? "Submitting..."
                      : "Submit Assignment"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssignment(null);
                      setSubmissionFile(null);
                      setSubmissionNotes("");
                      setError("");
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

