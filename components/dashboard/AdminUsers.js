"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Users, GraduationCap, BookOpen, Shield, Search, Eye } from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState({
    students: [],
    tutors: [],
    admins: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [viewingUser, setViewingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const [studentsData, tutorsData, adminsData] = await Promise.all([
        supabase.from("Students").select("*").order("created_at", { ascending: false }),
        supabase.from("Tutors").select("*").order("created_at", { ascending: false }),
        supabase.from("admins").select("*").order("created_at", { ascending: false }),
      ]);

      setUsers({
        students: studentsData.data || [],
        tutors: tutorsData.data || [],
        admins: adminsData.data || [],
      });
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = () => {
    let allUsers = [];
    
    if (filterRole === "all" || filterRole === "student") {
      allUsers.push(...users.students.map((u) => ({ ...u, role: "student" })));
    }
    if (filterRole === "all" || filterRole === "tutor") {
      allUsers.push(...users.tutors.map((u) => ({ ...u, role: "tutor" })));
    }
    if (filterRole === "all" || filterRole === "admin") {
      allUsers.push(...users.admins.map((u) => ({ ...u, role: "admin" })));
    }

    if (searchTerm) {
      allUsers = allUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return allUsers;
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "student":
        return <GraduationCap className="w-5 h-5 text-blue-500" />;
      case "tutor":
        return <BookOpen className="w-5 h-5 text-green-500" />;
      case "admin":
        return <Shield className="w-5 h-5 text-purple-500" />;
      default:
        return <Users className="w-5 h-5" />;
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      student: "bg-blue-100 text-blue-800",
      tutor: "bg-green-100 text-green-800",
      admin: "bg-purple-100 text-purple-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[role] || ""}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const viewUserDashboard = async (user) => {
    // For now, we'll just show user details
    // In a real implementation, you might want to navigate to a view-only version of their dashboard
    setViewingUser(user);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-1">View and manage all users (students, tutors, and admins)</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="tutor">Tutors</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{users.students.length}</p>
            </div>
            <GraduationCap className="w-12 h-12 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tutors</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{users.tutors.length}</p>
            </div>
            <BookOpen className="w-12 h-12 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Admins</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{users.admins.length}</p>
            </div>
            <Shield className="w-12 h-12 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers().map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">{getRoleIcon(user.role)}</div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || "Unnamed User"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email || "No email"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => viewUserDashboard(user)}
                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View Dashboard
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers().length === 0 && (
            <div className="text-center py-12 text-gray-500">No users found</div>
          )}
        </div>
      </div>

      {/* View User Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">User Details</h2>
                <button
                  onClick={() => setViewingUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-lg text-gray-900">{viewingUser.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-lg text-gray-900">{viewingUser.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Role</p>
                {getRoleBadge(viewingUser.role)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Joined</p>
                <p className="text-lg text-gray-900">
                  {new Date(viewingUser.created_at).toLocaleString()}
                </p>
              </div>
              {viewingUser.role === "student" && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Credits</p>
                  <p className="text-lg text-gray-900">
                    {parseFloat(viewingUser.credits || 0).toFixed(0)}
                  </p>
                </div>
              )}
              {viewingUser.role === "tutor" && (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Subjects</p>
                    <p className="text-lg text-gray-900">
                      {viewingUser.subjects?.length > 0
                        ? viewingUser.subjects.map((s) => s.subject || s).join(", ")
                        : "None"}
                    </p>
                  </div>
                  {viewingUser.bio && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Bio</p>
                      <p className="text-lg text-gray-900">{viewingUser.bio}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setViewingUser(null)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

