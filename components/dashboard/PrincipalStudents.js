"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Users, Mail, Plus, X, Trash2, Search } from "lucide-react";

export default function PrincipalStudents({ onStudentsChange }) {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState({});
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newStudentFirstName, setNewStudentFirstName] = useState("");
  const [newStudentLastName, setNewStudentLastName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [adding, setAdding] = useState(false);

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return;

      try {
        const { data: principalData, error: principalError } = await supabase
          .from("Principals")
          .select("students")
          .eq("user_id", user.id)
          .single();

        if (principalError) {
          console.error("Error fetching principal data:", principalError);
          setLoading(false);
          return;
        }

        const studentList = principalData?.students || [];
        setStudents(studentList);

        // Fetch student details
        if (studentList.length > 0) {
          const studentIds = studentList.map((s) => s.student_id || s.id).filter(Boolean);
          
          if (studentIds.length > 0) {
            const { data: studentDetails, error: detailsError } = await supabase
              .from("Students")
              .select("id, user_id, first_name, last_name, email, credits")
              .in("id", studentIds);

            if (!detailsError && studentDetails) {
              // Merge student details with the stored data
              const enrichedStudents = studentList.map((student) => {
                const details = studentDetails.find(
                  (d) => d.id === (student.student_id || student.id)
                );
                return {
                  ...student,
                  ...details,
                  name: details
                    ? `${details.first_name || ""} ${details.last_name || ""}`.trim() || details.email
                    : student.name || "Unknown",
                  email: details?.email || student.email || "",
                };
              });
              setStudents(enrichedStudents);
            }
          }
        }
      } catch (error) {
        console.error("Error:", error);
        setError("Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [user]);

  // Add a student: create a new student profile (no existing account required)
  const handleAddStudent = async () => {
    const f = (newStudentFirstName || "").trim();
    const l = (newStudentLastName || "").trim();
    if (!f && !l) {
      setError("At least first name or last name is required");
      return;
    }

    setAdding(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/create-principal-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          firstName: f || undefined,
          lastName: l || undefined,
          email: (newStudentEmail || "").trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create student profile");

      const { id, first_name, last_name, email: em } = data;
      const name = [first_name, last_name].filter(Boolean).join(" ").trim() || em || "Student";

      const { data: principalData, error: principalError } = await supabase
        .from("Principals")
        .select("students")
        .eq("user_id", user.id)
        .single();

      if (principalError) throw principalError;

      const currentStudents = principalData?.students || [];
      const updatedStudents = [
        ...currentStudents,
        { student_id: id, id, name, email: em || "", added_at: new Date().toISOString() },
      ];

      const { error: updateError } = await supabase
        .from("Principals")
        .update({ students: updatedStudents })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setStudents(updatedStudents);
      setSuccess(`Added ${name} successfully`);
      setNewStudentFirstName("");
      setNewStudentLastName("");
      setNewStudentEmail("");
      setShowAddModal(false);
      onStudentsChange?.();
    } catch (err) {
      console.error("Error adding student:", err);
      setError(err.message || "Failed to add student");
    } finally {
      setAdding(false);
    }
  };

  // Remove a student
  const handleRemoveStudent = async (studentId, studentName) => {
    setRemoving((prev) => ({ ...prev, [studentId]: true }));
    setSuccess("");
    setError("");

    try {
      const { data: principalData, error: principalError } = await supabase
        .from("Principals")
        .select("students")
        .eq("user_id", user.id)
        .single();

      if (principalError) {
        throw principalError;
      }

      const updatedStudents = (principalData?.students || []).filter(
        (s) => (s.student_id || s.id) !== studentId
      );

      const { error: updateError } = await supabase
        .from("Principals")
        .update({ students: updatedStudents })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setStudents(updatedStudents);
      setSuccess(`Removed ${studentName} successfully`);
      onStudentsChange?.();
    } catch (error) {
      console.error("Error removing student:", error);
      setError("Failed to remove student");
    } finally {
      setRemoving((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.name?.toLowerCase().includes(searchLower) ||
      student.email?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">My Students</h2>
          <p className="text-slate-600">
            Manage students associated with your principal account
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Student
        </button>
      </div>

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 mb-2">
            {searchTerm ? "No students found matching your search" : "No students added yet"}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowAddModal(true)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Add your first student
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const studentId = student.student_id || student.id;
            return (
              <div
                key={studentId}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-slate-900 mb-1">
                      {student.name || "Student"}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <Mail className="h-4 w-4" />
                      {student.email || "—"}
                    </div>
                    {student.credits !== undefined && (
                      <div className="text-sm text-slate-500">
                        Credits: {parseFloat(student.credits || 0).toFixed(0)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveStudent(studentId, student.name || student.email)}
                    disabled={removing[studentId]}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove student"
                  >
                    {removing[studentId] ? (
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Add Student</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewStudentFirstName("");
                    setNewStudentLastName("");
                    setNewStudentEmail("");
                    setError("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={newStudentFirstName}
                  onChange={(e) => setNewStudentFirstName(e.target.value)}
                  placeholder="e.g. Maria"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={newStudentLastName}
                  onChange={(e) => setNewStudentLastName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="student@school.edu"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Add a student profile to manage. No account is required—you can view as this student and manage sessions, assignments, and credits.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewStudentFirstName("");
                    setNewStudentLastName("");
                    setNewStudentEmail("");
                    setError("");
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStudent}
                  disabled={adding || (!(newStudentFirstName || "").trim() && !(newStudentLastName || "").trim())}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? "Adding..." : "Add Student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






























