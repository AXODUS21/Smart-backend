"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Megaphone,
  Plus,
  X,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { notifyAnnouncement } from "@/lib/notifications";

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [adminId, setAdminId] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    target_audience: ["students", "tutors"],
    priority: "normal",
    is_active: true,
  });

  // Get admin ID (for regular admins) or superadmin ID (for superadmins)
  useEffect(() => {
    const fetchAdminId = async () => {
      if (!user) return;

      // First check if user is a superadmin
      const { data: superadminData } = await supabase
        .from("superadmins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (superadminData) {
        // Superadmins don't need admin_id, set to null
        setAdminId(null);
        return;
      }

      // If not superadmin, check if user is an admin
      const { data: adminData } = await supabase
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminData) {
        setAdminId(adminData.id);
      }
    };

    fetchAdminId();
  }, [user]);

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from("Announcements")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setAnnouncements(data || []);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (!formData.title || !formData.message) {
        setError("Please fill in title and message.");
        return;
      }

      if (editingId) {
        // Update existing announcement
        const { error: updateError } = await supabase
          .from("Announcements")
          .update({
            title: formData.title,
            message: formData.message,
            target_audience: formData.target_audience,
            priority: formData.priority,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (updateError) throw updateError;
        setSuccess("Announcement updated successfully!");
      } else {
        // Create new announcement
        // admin_id can be null for superadmins
        const { error: insertError } = await supabase
          .from("Announcements")
          .insert({
            admin_id: adminId || null,
            title: formData.title,
            message: formData.message,
            target_audience: formData.target_audience,
            priority: formData.priority,
            is_active: formData.is_active,
          });

        if (insertError) throw insertError;
        setSuccess("Announcement created successfully!");

        // Send announcement notifications
        try {
          await notifyAnnouncement({
            title: formData.title,
            message: formData.message,
            priority: formData.priority,
            targetAudience: formData.target_audience,
            supabase,
          });
        } catch (notificationError) {
          // Log but don't fail if notification fails
          console.error('Failed to send announcement notifications:', notificationError);
        }
      }

      // Reset form
      setFormData({
        title: "",
        message: "",
        target_audience: ["students", "tutors"],
        priority: "normal",
        is_active: true,
      });
      setShowForm(false);
      setEditingId(null);

      // Refresh announcements
      const { data } = await supabase
        .from("Announcements")
        .select("*")
        .order("created_at", { ascending: false });

      setAnnouncements(data || []);
    } catch (error) {
      console.error("Error saving announcement:", error);
      setError(error.message || "Failed to save announcement.");
    }
  };

  // Handle edit
  const handleEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      message: announcement.message,
      target_audience: announcement.target_audience || ["students", "tutors"],
      priority: announcement.priority || "normal",
      is_active: announcement.is_active !== false,
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    try {
      const { error } = await supabase
        .from("Announcements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSuccess("Announcement deleted successfully!");
      setAnnouncements(announcements.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Error deleting announcement:", error);
      setError(error.message || "Failed to delete announcement.");
    }
  };

  // Toggle active status
  const handleToggleActive = async (announcement) => {
    try {
      const { error } = await supabase
        .from("Announcements")
        .update({
          is_active: !announcement.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", announcement.id);

      if (error) throw error;

      setAnnouncements(
        announcements.map((a) =>
          a.id === announcement.id
            ? { ...a, is_active: !a.is_active }
            : a
        )
      );
    } catch (error) {
      console.error("Error toggling announcement:", error);
      setError(error.message || "Failed to update announcement.");
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority) => {
    const styles = {
      low: "bg-gray-100 text-gray-800",
      normal: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[priority] || styles.normal
        }`}
      >
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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
            Announcements
          </h2>
          <p className="text-slate-500">
            Create and manage announcements for students and tutors
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({
              title: "",
              message: "",
              target_audience: ["students", "tutors"],
              priority: "normal",
              is_active: true,
            });
            setError("");
            setSuccess("");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {showForm ? "Cancel" : "New Announcement"}
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

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Announcement" : "Create New Announcement"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter announcement title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter announcement message"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Target Audience
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.target_audience.includes("students")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          target_audience: [
                            ...formData.target_audience,
                            "students",
                          ],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          target_audience: formData.target_audience.filter(
                            (t) => t !== "students"
                          ),
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <GraduationCap className="w-4 h-4" />
                  <span>Students</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.target_audience.includes("tutors")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          target_audience: [
                            ...formData.target_audience,
                            "tutors",
                          ],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          target_audience: formData.target_audience.filter(
                            (t) => t !== "tutors"
                          ),
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <BookOpen className="w-4 h-4" />
                  <span>Tutors</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? "Update" : "Create"} Announcement
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    title: "",
                    message: "",
                    target_audience: ["students", "tutors"],
                    priority: "normal",
                    is_active: true,
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

      {/* Announcements List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            All Announcements ({announcements.length})
          </h3>
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-sm">No announcements yet.</p>
              <p className="text-xs">Create your first announcement to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-3 rounded-lg border ${
                    announcement.is_active
                      ? "bg-white border-slate-200"
                      : "bg-slate-50 border-slate-200 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {announcement.title}
                        </h4>
                        {getPriorityBadge(announcement.priority)}
                        {!announcement.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 whitespace-pre-wrap mb-2 line-clamp-2">
                        {announcement.message}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(announcement.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>
                            {announcement.target_audience?.join(", ") || "All"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => handleToggleActive(announcement)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          announcement.is_active
                            ? "text-green-600 hover:bg-green-50"
                            : "text-gray-400 hover:bg-gray-50"
                        }`}
                        title={
                          announcement.is_active
                            ? "Deactivate"
                            : "Activate"
                        }
                      >
                        {announcement.is_active ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(announcement)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

