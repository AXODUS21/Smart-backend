"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Users, GraduationCap, BookOpen, Shield, Search, Eye, ArrowUpDown } from "lucide-react";

export default function AdminUsers() {
  const [users, setUsers] = useState({
    students: [],
    tutors: [],
    admins: [],
    principals: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [viewingUser, setViewingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Use the database function to get all users including those without profiles
      const { data: allUsersData, error: allUsersError } = await supabase
        .rpc('get_all_users_for_admin');

      if (allUsersError) {
        console.error("Error fetching all users:", allUsersError);
        // Fallback to old method if function doesn't exist
        const [studentsData, tutorsData, adminsData, principalsData] = await Promise.all([
          supabase.from("Students").select("*").order("created_at", { ascending: false }),
          supabase.from("Tutors").select("*").order("created_at", { ascending: false }),
          supabase.from("admins").select("*").order("created_at", { ascending: false }),
          supabase.from("Principals").select("*").order("created_at", { ascending: false }),
        ]);

        if (studentsData.error) {
          console.error("Error fetching students:", studentsData.error);
          throw studentsData.error;
        }
        if (tutorsData.error) {
          console.error("Error fetching tutors:", tutorsData.error);
          throw tutorsData.error;
        }
        if (adminsData.error) {
          console.error("Error fetching admins:", adminsData.error);
          throw adminsData.error;
        }
        if (principalsData.error) {
          console.error("Error fetching principals:", principalsData.error);
          // Don't throw, just log - principals table might not exist yet
        }

        setUsers({
          students: studentsData.data || [],
          tutors: tutorsData.data || [],
          admins: adminsData.data || [],
          principals: principalsData.data || [],
        });
      } else {
        // Transform the function result into the expected format
        const students = [];
        const tutors = [];
        const admins = [];
        const principals = [];
        
        (allUsersData || []).forEach(user => {
          const userObj = {
            id: user.id,
            user_id: user.id,
            email: user.email,
            name: user.name || user.email,
            created_at: user.created_at,
            role: user.role,
            has_profile: user.has_profile,
          };

          if (user.role === 'student') {
            students.push(userObj);
          } else if (user.role === 'tutor') {
            tutors.push(userObj);
          } else if (user.role === 'admin' || user.role === 'superadmin') {
            admins.push(userObj);
          } else if (user.role === 'principal') {
            principals.push(userObj);
          } else if (user.role === 'pending') {
            // Add pending users to students list with a note
            students.push({ ...userObj, role: 'pending' });
          }
        });

        setUsers({
          students,
          tutors,
          admins,
          principals,
        });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = () => {
    let allUsers = [];
    
    if (filterRole === "all" || filterRole === "student") {
      allUsers.push(...users.students.map((u) => ({ ...u, role: u.role || "student" })));
    }
    if (filterRole === "all" || filterRole === "tutor") {
      allUsers.push(...users.tutors.map((u) => ({ ...u, role: u.role || "tutor" })));
    }
    if (filterRole === "all" || filterRole === "admin") {
      allUsers.push(...users.admins.map((u) => ({ ...u, role: u.role || "admin" })));
    }
    if (filterRole === "all" || filterRole === "principal") {
      allUsers.push(...users.principals.map((u) => ({ ...u, role: u.role || "principal" })));
    }

    // Filter out users with "Unnamed User" as their name
    allUsers = allUsers.filter(
      (u) => u.name !== "Unnamed User" && u.name !== "Unnamed"
    );

    if (searchTerm) {
      allUsers = allUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort users
    allUsers.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle different data types
      if (sortField === "created_at") {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      } else if (sortField === "name" || sortField === "email") {
        aValue = (aValue || "").toLowerCase();
        bValue = (bValue || "").toLowerCase();
      } else if (sortField === "role") {
        aValue = a.role || "";
        bValue = b.role || "";
      } else {
        // For numeric fields like credits
        aValue = parseFloat(aValue || 0);
        bValue = parseFloat(bValue || 0);
      }

      // Compare values
      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

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
      case "principal":
        return <Users className="w-5 h-5 text-indigo-500" />;
      default:
        return <Users className="w-5 h-5" />;
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      student: "bg-blue-100 text-blue-800",
      tutor: "bg-green-100 text-green-800",
      admin: "bg-purple-100 text-purple-800",
      principal: "bg-indigo-100 text-indigo-800",
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

  const userStatsData = [
    {
      title: "Total Students",
      value: users.students.length.toString(),
      icon: GraduationCap,
      bgColor: "bg-blue-500",
    },
    {
      title: "Total Tutors",
      value: users.tutors.length.toString(),
      icon: BookOpen,
      bgColor: "bg-emerald-500",
    },
    {
      title: "Total Admins",
      value: users.admins.length.toString(),
      icon: Shield,
      bgColor: "bg-purple-500",
    },
    {
      title: "Total Principals",
      value: users.principals.length.toString(),
      icon: Users,
      bgColor: "bg-indigo-500",
    },
  ];

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
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">User Management</h2>
        <p className="text-slate-500">View and manage all users (students, tutors, and admins)</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-500"
              />
            </div>
          </div>
          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="tutor">Tutors</option>
              <option value="admin">Admins</option>
              <option value="principal">Principals</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="created_at">Joined Date</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="role">Role</option>
              </select>
            </div>
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userStatsData.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className={`${metric.bgColor} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <Icon size={24} className="text-white" />
                </div>
              </div>
              <p className="text-white/80 text-sm font-medium mb-1">
                {metric.title}
              </p>
              <p className="text-3xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">All Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredUsers().map((user, index) => (
                <tr key={user.id || user.user_id || `user-${index}-${user.email}`} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">{getRoleIcon(user.role)}</div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">
                          {user.name || user.email || "Unknown"}
                          {user.has_profile === false && (
                            <span className="ml-2 text-xs text-amber-600">(Profile pending)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                    {user.has_profile === false && (
                      <span className="ml-2 text-xs text-amber-600">(Incomplete)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.email || "No email"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
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
            <div className="text-center py-12 text-slate-500">No users found</div>
          )}
        </div>
      </div>

      {/* View User Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">User Details</h2>
                <button
                  onClick={() => setViewingUser(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Name</p>
                <p className="text-lg text-slate-900">{viewingUser.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Email</p>
                <p className="text-lg text-slate-900">{viewingUser.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Role</p>
                {getRoleBadge(viewingUser.role)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Joined</p>
                <p className="text-lg text-slate-900">
                  {new Date(viewingUser.created_at).toLocaleString()}
                </p>
              </div>
              {(viewingUser.role === "student" || viewingUser.role === "principal") && (
                <div>
                  <p className="text-sm font-medium text-slate-500">Credits</p>
                  <p className="text-lg text-slate-900">
                    {parseFloat(viewingUser.credits || 0).toFixed(0)}
                  </p>
                </div>
              )}
              {viewingUser.role === "principal" && (
                <div>
                  <p className="text-sm font-medium text-slate-500">Students</p>
                  <p className="text-lg text-slate-900">
                    {viewingUser.students?.length || 0} student(s)
                  </p>
                </div>
              )}
              {viewingUser.role === "tutor" && (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Subjects</p>
                    <p className="text-lg text-slate-900">
                      {viewingUser.subjects?.length > 0
                        ? viewingUser.subjects.map((s) => s.subject || s).join(", ")
                        : "None"}
                    </p>
                  </div>
                  {viewingUser.bio && (
                    <div>
                      <p className="text-sm font-medium text-slate-500">Bio</p>
                      <p className="text-lg text-slate-900">{viewingUser.bio}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-6 border-t border-slate-200">
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

