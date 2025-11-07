"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  BookOpen,
  Calendar,
  FileText,
  Search,
  X,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Upload,
  Download,
  Trash2,
} from "lucide-react";

export default function TutorAssignments() {
  const { user } = useAuth();
  const [tutorId, setTutorId] = useState(null);
  const [students, setStudents] = useState([]); // List of accepted students with details
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form state
  const [formData, setFormData] = useState({
    student_id: "",
    title: "",
    description: "",
    subject: "",
    due_date: "",
    max_points: "",
    file: null,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Fetch tutor ID and all students
  useEffect(() => {
    const fetchTutorData = async () => {
      if (!user) return;

      try {
        // Get tutor ID
        const { data: tutorData, error: tutorError } = await supabase
          .from("Tutors")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (tutorError) {
          console.error("Error fetching tutor:", tutorError);
          return;
        }
        
        if (tutorData) {
          setTutorId(tutorData.id);
        }

        // Get ALL students registered in the app
        const { data: studentsData, error: studentsError } = await supabase
          .from("Students")
          .select("id, name, email, user_id");

        if (studentsError) {
          console.error("Error fetching students:", studentsError);
          setStudents([]);
          return;
        }

        if (studentsData && studentsData.length > 0) {
          // Filter out students without user_id and map
          const mappedStudents = studentsData
            .filter((s) => s.user_id) // Only include students with user_id
            .map((s) => ({
              student_id: s.user_id,
              id: s.id,
              name: s.name || s.email || "Unnamed Student",
              email: s.email || "No email",
            }))
            .sort((a, b) => {
              // Sort by name, handling nulls
              const nameA = a.name.toLowerCase();
              const nameB = b.name.toLowerCase();
              return nameA.localeCompare(nameB);
            });

          console.log("Fetched students:", mappedStudents.length, mappedStudents);
          setStudents(mappedStudents);
        } else {
          console.log("No students found in database. Data:", studentsData);
          setStudents([]);
        }
      } catch (error) {
        console.error("Error fetching tutor data:", error);
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchTutorData();
  }, [user]);

  // Fetch assignments
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!tutorId) return;

      try {
        const { data, error } = await supabase
          .from("Assignments")
          .select(
            `
            *,
            student:student_id (
              id,
              name,
              email
            )
          `
          )
          .eq("tutor_id", tutorId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Mark overdue assignments
        const now = new Date();
        const updatedAssignments = (data || []).map((assignment) => {
          if (
            assignment.due_date &&
            new Date(assignment.due_date) < now &&
            assignment.status === "assigned"
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
  }, [tutorId]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!formData.student_id || !formData.title) {
        setError("Please fill in all required fields (Student and Title).");
        setSubmitting(false);
        return;
      }

      // Get student's bigint ID from the selected student_id (which is user_id)
      const selectedStudent = students.find(
        (s) => s.student_id === formData.student_id
      );
      if (!selectedStudent) {
        setError("Selected student not found.");
        setSubmitting(false);
        return;
      }

      let fileUrl = null;

      // Upload file if provided
      if (formData.file) {
        try {
          // Sanitize filename - remove special characters and spaces
          const sanitizedFileName = formData.file.name
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/\s+/g, '_');
          
          const filePath = `${tutorId}_${Date.now()}_${sanitizedFileName}`;
          
          // Try to upload to storage
          const { data: storageData, error: storageError } = await supabase.storage
            .from("assignments")
            .upload(filePath, formData.file, {
              cacheControl: '3600',
              upsert: false
            });

          if (storageError) {
            // If storage bucket doesn't exist or has permission issues, continue without file
            console.error("Storage upload error:", storageError);
            // Don't block assignment creation if file upload fails
            // Just show a warning but allow the assignment to be created
            if (storageError.message?.includes("Bucket not found") || storageError.message?.includes("not found")) {
              setError("Storage bucket 'assignments' not found. Please create it in Supabase Dashboard > Storage. Assignment will be created without attachment.");
            } else {
              setError("Warning: File upload failed, but assignment will be created without attachment. Error: " + storageError.message);
            }
            // Continue without file
          } else if (storageData) {
            // Get public URL
            const { data: urlData } = supabase.storage.from("assignments").getPublicUrl(filePath);
            fileUrl = urlData?.publicUrl || filePath;
          }
        } catch (uploadError) {
          console.error("File upload exception:", uploadError);
          // Continue without file - don't block assignment creation
          setError("Warning: File upload failed, but assignment will be created without attachment.");
        }
      }

      // Create assignment
      const { error: insertError } = await supabase
        .from("Assignments")
        .insert({
          tutor_id: tutorId,
          student_id: selectedStudent.id, // Use bigint ID
          title: formData.title,
          description: formData.description || null,
          subject: formData.subject || null,
          due_date: formData.due_date || null,
          max_points: formData.max_points ? parseFloat(formData.max_points) : null,
          file_url: fileUrl,
          status: "assigned",
        });

      if (insertError) throw insertError;

      setSuccess("Assignment created successfully!");
      setFormData({
        student_id: "",
        title: "",
        description: "",
        subject: "",
        due_date: "",
        max_points: "",
        file: null,
      });
      setShowForm(false);

      // Refresh assignments list
      const { data } = await supabase
        .from("Assignments")
        .select(
          `
          *,
          student:student_id (
            id,
            name,
            email
          )
        `
        )
        .eq("tutor_id", tutorId)
        .order("created_at", { ascending: false });

      setAssignments(data || []);
    } catch (error) {
      console.error("Error creating assignment:", error);
      setError(error.message || "Failed to create assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle file input
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFormData({ ...formData, file });
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch =
      assignment.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.student?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || assignment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Get status badge
  const getStatusBadge = (status) => {
    const styles = {
      assigned: "bg-blue-100 text-blue-800",
      submitted: "bg-yellow-100 text-yellow-800",
      graded: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
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
            Assignments
          </h2>
          <p className="text-slate-500">
            Create and manage assignments for your students
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {showForm ? "Cancel" : "New Assignment"}
        </button>
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

      {/* Create Assignment Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Create New Assignment
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Student Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Student <span className="text-red-500">*</span>
              </label>
              {loadingStudents ? (
                <div className="w-full rounded-md border border-slate-300 px-3 py-2 bg-slate-50 text-slate-500">
                  Loading students...
                </div>
              ) : (
                <>
                  <select
                    value={formData.student_id}
                    onChange={(e) =>
                      setFormData({ ...formData, student_id: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a student...</option>
                    {students.map((student) => (
                      <option key={student.student_id || student.id} value={student.student_id}>
                        {student.name} ({student.email})
                      </option>
                    ))}
                  </select>
                  {students.length === 0 && !loadingStudents && (
                    <p className="text-sm text-amber-600 mt-1">
                      No students found in the system. Please check if there are any students registered.
                    </p>
                  )}
                  {students.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {students.length} student{students.length !== 1 ? 's' : ''} available
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assignment Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Math Chapter 5 Homework"
                required
              />
            </div>

            {/* Subject and Due Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Maximum Points
              </label>
              <input
                type="number"
                value={formData.max_points}
                onChange={(e) =>
                  setFormData({ ...formData, max_points: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 100"
                min="0"
                step="0.1"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Assignment instructions and details..."
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Attach File (Optional)
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {formData.file && (
                  <span className="text-sm text-slate-600">
                    {formData.file.name}
                  </span>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Creating..." : "Create Assignment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    student_id: "",
                    title: "",
                    description: "",
                    subject: "",
                    due_date: "",
                    max_points: "",
                    file: null,
                  });
                  setError("");
                }}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assignments List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="assigned">Assigned</option>
              <option value="submitted">Submitted</option>
              <option value="graded">Graded</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredAssignments.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No assignments found</p>
              <p className="text-sm">
                {assignments.length === 0
                  ? "Create your first assignment to get started."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {assignment.title}
                      </h3>
                      {getStatusBadge(assignment.status)}
                    </div>

                    <div className="space-y-1 text-sm text-slate-600 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Student:</span>
                        <span>
                          {assignment.student?.name || assignment.student?.email || "Unknown"}
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
                        <span>Due: {formatDate(assignment.due_date)}</span>
                      </div>
                      {assignment.max_points && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Points:</span>
                          <span>
                            {assignment.points !== null && assignment.points !== undefined
                              ? `${assignment.points}`
                              : "Not graded"}
                            {assignment.max_points && ` / ${assignment.max_points}`}
                          </span>
                        </div>
                      )}
                      {assignment.description && (
                        <p className="text-slate-700 mt-2 whitespace-pre-wrap">
                          {assignment.description}
                        </p>
                      )}
                    </div>

                    <div className="text-xs text-slate-400">
                      Created: {formatDate(assignment.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {assignment.file_url && (
                      <a
                        href={assignment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download file"
                      >
                        <Download className="w-5 h-5" />
                      </a>
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

