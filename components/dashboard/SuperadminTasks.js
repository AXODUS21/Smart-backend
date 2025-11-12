"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  ListTodo,
  Plus,
  Calendar,
  Flag,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  User,
} from "lucide-react";

export default function SuperadminTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    assigned_to_admin_id: "",
  });

  useEffect(() => {
    fetchTasks();
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("id, name, email")
        .order("name", { ascending: true });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: superadminData } = await supabase
        .from("superadmins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!superadminData) {
        console.error("Superadmin record not found");
        return;
      }

      let query = supabase
        .from("admintasks")
        .select(`
          *,
          assigned_admin:assigned_to_admin_id (
            id,
            name,
            email
          )
        `)
        .eq("superadmin_id", superadminData.id)
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      alert("Please enter a task title");
      return;
    }

    if (!newTask.assigned_to_admin_id) {
      alert("Please select an admin to assign the task to");
      return;
    }

    try {
      // Get superadmin ID
      const { data: superadminData } = await supabase
        .from("superadmins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!superadminData) {
        alert("Superadmin record not found");
        return;
      }

      const { error } = await supabase.from("admintasks").insert({
        superadmin_id: superadminData.id,
        assigned_to_admin_id: newTask.assigned_to_admin_id,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        status: "pending",
      });

      if (error) throw error;

      setShowAddModal(false);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        assigned_to_admin_id: "",
      });
      fetchTasks();
    } catch (error) {
      console.error("Error adding task:", error);
      alert("Error adding task. Please try again.");
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const { error } = await supabase
        .from("admintasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Error updating task. Please try again.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const { error } = await supabase.from("admintasks").delete().eq("id", taskId);

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Error deleting task. Please try again.");
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || ""}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        color: "bg-yellow-100 text-yellow-800",
        icon: <Clock className="w-4 h-4" />,
        label: "Pending",
      },
      in_progress: {
        color: "bg-blue-100 text-blue-800",
        icon: <Clock className="w-4 h-4" />,
        label: "In Progress",
      },
      completed: {
        color: "bg-green-100 text-green-800",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Completed",
      },
      cancelled: {
        color: "bg-red-100 text-red-800",
        icon: <XCircle className="w-4 h-4" />,
        label: "Cancelled",
      },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  };

  const filteredTasks = () => {
    let filtered = tasks;

    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (adminFilter !== "all") {
      filtered = filtered.filter(
        (t) => t.assigned_to_admin_id === parseInt(adminFilter)
      );
    }

    return filtered;
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Assign Tasks to Admins
          </h2>
          <p className="text-slate-500">
            Create and assign tasks for administrators
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Assign Task
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Admin Filter
            </label>
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2"
            >
              <option value="all">All Admins</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name || admin.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks().map((task) => (
          <div
            key={task.id}
            className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-slate-600 mb-3">{task.description}</p>
                )}
                {task.assigned_admin && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                    <User className="w-4 h-4" />
                    <span>
                      Assigned to: <strong>{task.assigned_admin.name || task.assigned_admin.email}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTask(task)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Status</span>
                {getStatusBadge(task.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Priority</span>
                {getPriorityBadge(task.priority)}
              </div>
              {task.due_date && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              {task.status !== "completed" && (
                <button
                  onClick={() =>
                    handleUpdateTask(task.id, {
                      status: task.status === "pending" ? "in_progress" : "completed",
                      ...(task.status === "in_progress" && { completed_at: new Date().toISOString() }),
                    })
                  }
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  {task.status === "pending" ? "Start" : "Complete"}
                </button>
              )}
              {task.status !== "cancelled" && (
                <button
                  onClick={() => handleUpdateTask(task.id, { status: "cancelled" })}
                  className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredTasks().length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-slate-200">
          <ListTodo className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">No tasks found</p>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Assign Task to Admin</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign To Admin *
                </label>
                <select
                  value={newTask.assigned_to_admin_id}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to_admin_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                  required
                >
                  <option value="">Select an admin</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name || admin.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 placeholder:text-slate-500"
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 placeholder:text-slate-500"
                  rows={3}
                  placeholder="Enter task description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewTask({
                    title: "",
                    description: "",
                    priority: "medium",
                    due_date: "",
                    assigned_to_admin_id: "",
                  });
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Assign Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Edit Task</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editingTask.description || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={editingTask.priority}
                  onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={editingTask.due_date ? editingTask.due_date.split("T")[0] : ""}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, due_date: e.target.value || null })
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setEditingTask(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleUpdateTask(editingTask.id, {
                    title: editingTask.title,
                    description: editingTask.description,
                    priority: editingTask.priority,
                    due_date: editingTask.due_date,
                  });
                  setEditingTask(null);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






