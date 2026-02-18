"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { buildPrimaryProfileName, DEFAULT_PROFILE_ID } from "@/lib/studentProfiles";
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
  const [studentFilter, setStudentFilter] = useState("all"); // "all" or student_id
  const [sortBy, setSortBy] = useState("status"); // newest, oldest, student, dueDate, status, submittedDate

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
  const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState(null);
  const [gradingPoints, setGradingPoints] = useState("");
  const [gradingFeedback, setGradingFeedback] = useState("");
  const [grading, setGrading] = useState(false);

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
          .select("id, name, email, user_id, first_name, last_name, extra_profiles");

        // Get ALL schools
        const { data: schoolsData, error: schoolsError } = await supabase
          .from("Schools")
          .select("id, name, school_type");

        if (studentsError) {
          console.error("Error fetching students:", studentsError);
        }
        
        if (schoolsError) {
          console.error("Error fetching schools:", schoolsError);
        }

        const allRecipients = [];

        // Process Students
        if (studentsData && studentsData.length > 0) {
          studentsData
            .filter((s) => s.user_id)
            .forEach((s) => {
              const baseName = buildPrimaryProfileName(s);
              allRecipients.push({
                key: `${s.id}::${DEFAULT_PROFILE_ID}`,
                studentRecordId: s.id,
                userId: s.user_id,
                profileId: DEFAULT_PROFILE_ID,
                profileName: baseName,
                displayName: `${baseName} (Primary)`,
                email: s.email || "No email",
              });

              if (Array.isArray(s.extra_profiles)) {
                s.extra_profiles.forEach((profile) => {
                  allRecipients.push({
                    key: `${s.id}::${profile.id}`,
                    studentRecordId: s.id,
                    userId: s.user_id,
                    profileId: profile.id,
                    profileName: profile.name || baseName,
                    displayName: `${profile.name || "Family Member"} (${baseName})`,
                    email: s.email || "No email",
                  });
                });
              }
            });
        }

        // Process Schools
        if (schoolsData && schoolsData.length > 0) {
          schoolsData.forEach((school) => {
            allRecipients.push({
              key: `school_${school.id}`,
              studentRecordId: school.id,
              userId: null,
              profileId: null,
              profileName: school.name,
              displayName: `${school.name} (${school.school_type || 'School'})`,
              email: "School Account",
              isSchool: true,
            });
          });
        }

        if (allRecipients.length > 0) {
          allRecipients.sort((a, b) =>
            a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
          );

          console.log("Fetched recipients:", allRecipients.length);
          setStudents(allRecipients);
        } else {
          console.log("No recipients found.");
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

      // Find the selected student profile entry
      const selectedStudent = students.find(
        (s) => s.key === formData.student_id
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
      // Create assignment
      const insertPayload = {
          tutor_id: tutorId,
          title: formData.title,
          description: formData.description || null,
          subject: formData.subject || null,
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
          max_points: formData.max_points ? parseFloat(formData.max_points) : null,
          file_url: fileUrl,
          status: "assigned",
      };

      if (selectedStudent.isSchool) {
          insertPayload.school_id = selectedStudent.studentRecordId;
          insertPayload.student_id = null; // Ensure this is handled if column is nullable
          insertPayload.profile_id = null;
          insertPayload.profile_name = selectedStudent.profileName;
      } else {
          insertPayload.student_id = selectedStudent.studentRecordId;
          insertPayload.profile_id = selectedStudent.profileId;
          insertPayload.profile_name = selectedStudent.profileName;
      }

      const { error: insertError } = await supabase
        .from("Assignments")
        .insert(insertPayload);

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

  // Handle grading submission
  const handleGradeAssignment = async (assignmentId) => {
    setGrading(true);
    setError("");
    setSuccess("");

    try {
      if (!gradingPoints || gradingPoints === "") {
        setError("Please enter points for this assignment.");
        setGrading(false);
        return;
      }

      const points = parseFloat(gradingPoints);
      const assignment = assignments.find((a) => a.id === assignmentId);
      
      if (assignment && assignment.max_points && points > assignment.max_points) {
        setError(`Points cannot exceed maximum points (${assignment.max_points}).`);
        setGrading(false);
        return;
      }

      // Update assignment with grade
      const { error: updateError } = await supabase
        .from("Assignments")
        .update({
          points: points,
          status: "graded",
        })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      setSuccess("Assignment graded successfully!");
      setSelectedAssignmentForGrading(null);
      setGradingPoints("");
      setGradingFeedback("");

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
      console.error("Error grading assignment:", error);
      setError(error.message || "Failed to grade assignment.");
    } finally {
      setGrading(false);
    }
  };

  // Filter and sort assignments
  const filteredAssignments = assignments
    .filter((assignment) => {
      const matchesSearch =
        !searchTerm ||
        assignment.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.student?.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || assignment.status === statusFilter;

      const matchesStudent =
        studentFilter === "all" || assignment.student_id === parseInt(studentFilter);

      return matchesSearch && matchesStatus && matchesStudent;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at) - new Date(a.created_at);
        case "oldest":
          return new Date(a.created_at) - new Date(b.created_at);
        case "student":
          const nameA = (a.student?.name || a.student?.email || "").toLowerCase();
          const nameB = (b.student?.name || b.student?.email || "").toLowerCase();
          return nameA.localeCompare(nameB);
        case "dueDate":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        case "status":
          // Priority: submitted > assigned > graded > overdue
          const statusOrder = { submitted: 0, assigned: 1, graded: 2, overdue: 3 };
          const orderA = statusOrder[a.status] ?? 4;
          const orderB = statusOrder[b.status] ?? 4;
          return orderA - orderB;
        case "submittedDate":
          // Sort by submission date (newest submissions first)
          if (!a.submission_date && !b.submission_date) return 0;
          if (!a.submission_date) return 1;
          if (!b.submission_date) return -1;
          return new Date(b.submission_date) - new Date(a.submission_date);
        default:
          return 0;
      }
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


  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-64 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1">
            Assignments
          </h2>
          <p className="text-sm text-slate-500">
            Create and manage assignments for your students
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Cancel" : "New Assignment"}
        </button>
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

      {/* Create Assignment Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900 mb-3">
            Create New Assignment
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Student Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
                      <option key={student.key} value={student.key}>
                        {student.displayName} ({student.email})
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
                      {students.length} profile{students.length !== 1 ? 's' : ''} available
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Assignment instructions and details..."
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="px-4 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
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
              <div className="flex gap-2 flex-wrap">
                <select
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Students</option>
                  {(() => {
                    const studentMap = new Map();
                    assignments
                      .filter((a) => a.student_id)
                      .forEach((a) => {
                        if (!studentMap.has(a.student_id)) {
                          const studentName = a.student?.name || a.student?.email || "Unknown";
                          studentMap.set(a.student_id, studentName);
                        }
                      });
                    return Array.from(studentMap.entries())
                      .sort((a, b) => a[1].localeCompare(b[1]))
                      .map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ));
                  })()}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="submitted">Needs Grading</option>
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
                  <option value="student">Sort: By Student</option>
                  <option value="dueDate">Sort: By Due Date</option>
                </select>
              </div>
            </div>
            {filteredAssignments.length > 0 && (
              <div className="text-xs text-slate-500">
                Showing {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
                {statusFilter === "submitted" && (
                  <span className="ml-2 font-medium text-yellow-600">
                    ({filteredAssignments.filter(a => a.status === "submitted").length} need grading)
                  </span>
                )}
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
                {assignments.length === 0
                  ? "Create your first assignment to get started."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {assignment.title}
                      </h3>
                      {getStatusBadge(assignment.status)}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                      <span className="font-medium">Student:</span>
                      <span className="truncate">
                        {assignment.student?.name || assignment.student?.email || "Unknown"}
                      </span>
                      {assignment.profile_name && (
                        <>
                          <span className="text-slate-400">•</span>
                          <span className="font-medium">Profile:</span>
                          <span>{assignment.profile_name}</span>
                        </>
                      )}
                      {assignment.subject && (
                        <>
                          <span className="text-slate-400">•</span>
                          <BookOpen className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{assignment.subject}</span>
                        </>
                      )}
                      <span className="text-slate-400">•</span>
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Due: {formatDate(assignment.due_date)}</span>
                      {assignment.max_points && (
                        <>
                          <span className="text-slate-400">•</span>
                          <span className="font-medium">Points:</span>
                          <span>
                            {assignment.points !== null && assignment.points !== undefined
                              ? `${assignment.points}`
                              : "Not graded"}
                            {assignment.max_points && ` / ${assignment.max_points}`}
                          </span>
                        </>
                      )}
                    </div>

                    {assignment.description && (
                      <p className="text-xs text-slate-700 mt-1.5 whitespace-pre-wrap line-clamp-2">
                        {assignment.description}
                      </p>
                    )}

                    {/* Submission Info */}
                    {assignment.submission_file_url && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-1.5 text-yellow-800 mb-1">
                          <CheckCircle className="w-3 h-3" />
                          <span className="font-medium text-xs">Submitted by Student</span>
                        </div>
                        <div className="text-xs text-yellow-700 space-y-0.5">
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
                            <div className="mt-1">
                              <span className="font-medium">Student Notes:</span>{" "}
                              <span>{assignment.submission_notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}


                    <div className="text-xs text-slate-400 mt-1">
                      Created: {formatDate(assignment.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 flex-col">
                    {assignment.file_url && (
                      <a
                        href={assignment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download assignment file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    {assignment.status === "submitted" && (
                      <button
                        onClick={() => {
                          setSelectedAssignmentForGrading(assignment);
                          setGradingPoints(assignment.max_points ? assignment.max_points.toString() : "");
                          setGradingFeedback("");
                        }}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Grade assignment"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Grading Modal */}
      {selectedAssignmentForGrading && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Grade Assignment
                </h3>
                <button
                  onClick={() => {
                    setSelectedAssignmentForGrading(null);
                    setGradingPoints("");
                    setGradingFeedback("");
                    setError("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-3 p-3 bg-slate-50 rounded-lg">
                <h4 className="font-medium text-sm text-slate-900 mb-1">
                  {selectedAssignmentForGrading.title}
                </h4>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <div>
                    <span className="font-medium">Student:</span>{" "}
                    {selectedAssignmentForGrading.student?.name || 
                     selectedAssignmentForGrading.student?.email || 
                     "Unknown"}
                  </div>
                  {selectedAssignmentForGrading.profile_name && (
                    <div>
                      <span className="font-medium">Profile:</span> {selectedAssignmentForGrading.profile_name}
                    </div>
                  )}
                  {selectedAssignmentForGrading.max_points && (
                    <div>
                      <span className="font-medium">Max Points:</span> {selectedAssignmentForGrading.max_points}
                    </div>
                  )}
                  {selectedAssignmentForGrading.submission_date && (
                    <div>
                      <span className="font-medium">Submitted:</span> {formatDate(selectedAssignmentForGrading.submission_date)}
                    </div>
                  )}
                </div>
              </div>

              {selectedAssignmentForGrading.submission_file_url && (
                <div className="mb-3">
                  <a
                    href={selectedAssignmentForGrading.submission_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    View Student Submission
                  </a>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGradeAssignment(selectedAssignmentForGrading.id);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Points <span className="text-red-500">*</span>
                    {selectedAssignmentForGrading.max_points && (
                      <span className="text-slate-500 ml-1">
                        (Max: {selectedAssignmentForGrading.max_points})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={gradingPoints}
                    onChange={(e) => setGradingPoints(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter points"
                    min="0"
                    max={selectedAssignmentForGrading.max_points || undefined}
                    step="0.1"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={grading || !gradingPoints}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {grading ? "Grading..." : "Submit Grade"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssignmentForGrading(null);
                      setGradingPoints("");
                      setGradingFeedback("");
                      setError("");
                    }}
                    className="px-4 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
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

