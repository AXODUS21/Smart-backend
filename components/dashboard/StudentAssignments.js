"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
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

export default function StudentAssignments() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState({});
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Get student's bigint ID
  useEffect(() => {
    const fetchStudentId = async () => {
      if (!user) return;

      const { data: studentData } = await supabase
        .from("Students")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (studentData) {
        setStudentId(studentData.id);
      }
    };

    fetchStudentId();
  }, [user]);

  // Fetch assignments
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!studentId) return;

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

        setAssignments(updatedAssignments);
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [studentId]);

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

      setAssignments(updatedData || []);
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
        className={`px-3 py-1 rounded-full text-xs font-medium ${
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
  const filteredAssignments = assignments.filter((assignment) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "overdue") return isOverdue(assignment);
    return assignment.status === statusFilter;
  });

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
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            My Assignments
          </h2>
          <p className="text-slate-500">
            View and submit your assignments
          </p>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Assignments List */}
      <div className="space-y-4">
        {filteredAssignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-900 mb-2">
              No assignments found
            </p>
            <p className="text-slate-500">
              {assignments.length === 0
                ? "You don't have any assignments yet."
                : "Try adjusting your filter criteria."}
            </p>
          </div>
        ) : (
          filteredAssignments.map((assignment) => (
            <div
              key={assignment.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {assignment.title}
                    </h3>
                    {getStatusBadge(assignment)}
                    {isOverdue(assignment) && (
                      <span className="text-xs text-red-600 font-medium">
                        Overdue
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">From:</span>
                      <span>
                        {assignment.tutor?.name ||
                          assignment.tutor?.email ||
                          "Tutor"}
                      </span>
                    </div>
                    {assignment.subject && (
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        <span>{assignment.subject}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Due: {formatDate(assignment.due_date)}
                        {isOverdue(assignment) && (
                          <span className="text-red-600 ml-2">(Past Due)</span>
                        )}
                      </span>
                    </div>
                    {assignment.max_points && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Points:</span>
                        <span>
                          {assignment.points !== null &&
                          assignment.points !== undefined
                            ? `${assignment.points}`
                            : "Not graded"}
                          {assignment.max_points && ` / ${assignment.max_points}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {assignment.description && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {assignment.description}
                      </p>
                    </div>
                  )}

                  {/* Assignment File */}
                  {assignment.file_url && (
                    <div className="mt-3">
                      <a
                        href={assignment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download Assignment File
                      </a>
                    </div>
                  )}

                  {/* Submission Info */}
                  {assignment.submission_file_url && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-800 mb-2">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium text-sm">Submitted</span>
                      </div>
                      <div className="text-xs text-green-700 space-y-1">
                        <div>
                          Submitted: {formatDate(assignment.submission_date)}
                        </div>
                        <a
                          href={assignment.submission_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <Download className="w-3 h-3" />
                          View Submission
                        </a>
                        {assignment.submission_notes && (
                          <div className="mt-2">
                            <span className="font-medium">Notes:</span>{" "}
                            {assignment.submission_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              {assignment.status === "assigned" &&
                !assignment.submission_file_url && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setSelectedAssignment(assignment)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Submit Assignment
                    </button>
                  </div>
                )}
            </div>
          ))
        )}
      </div>

      {/* Submission Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-900">
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

              <div className="mb-4">
                <h4 className="font-medium text-slate-900 mb-2">
                  {selectedAssignment.title}
                </h4>
                {selectedAssignment.description && (
                  <p className="text-sm text-slate-600 mb-2">
                    {selectedAssignment.description}
                  </p>
                )}
                <p className="text-sm text-slate-500">
                  Due: {formatDate(selectedAssignment.due_date)}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitAssignment(selectedAssignment.id);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Upload File <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                      <Upload className="w-5 h-5" />
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
                      <span className="text-sm text-slate-600">
                        {submissionFile.name}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes or comments about your submission..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting[selectedAssignment.id] || !submissionFile}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
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

