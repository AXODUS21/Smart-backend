"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Users, GraduationCap, BookOpen, Shield, Search, Eye, ArrowUpDown, FileSpreadsheet, FileType } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [viewingUser, setViewingUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditType, setCreditType] = useState("add"); // 'add' or 'remove'
  const [isUpdatingCredits, setIsUpdatingCredits] = useState(false);
  const [creditMessage, setCreditMessage] = useState(null);

  
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
        // Fallback to direct table queries could go here if needed
      } else {
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
            credits: user.credits,
            // Principal specific fields
            district_school_name: user.district_school_name,
            type_of_school: user.type_of_school,
            contact_number: user.contact_number,
            address: user.address,
            school_count: parseInt(user.school_count || 0),
            // Tutor specific fields
            subjects: user.subjects,
            bio: user.bio,
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
            students.push({ ...userObj, role: 'pending' });
          }
        });

        setUsers({
          students,
          tutors,
          admins,
          principals,
        });
        
        console.log("AdminUsers: Fetched Principals with counts:", principals.length);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };


  const filteredUsers = useMemo(() => {
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

    // Apply search filter with trimmed search term
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch) {
      const searchLower = trimmedSearch.toLowerCase();
      allUsers = allUsers.filter((u) => {
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const firstName = (u.first_name || '').toLowerCase();
        const lastName = (u.last_name || '').toLowerCase();
        const schoolName = (u.district_school_name || '').toLowerCase();
        
        return name.includes(searchLower) || 
               email.includes(searchLower) || 
               firstName.includes(searchLower) || 
               lastName.includes(searchLower) ||
               schoolName.includes(searchLower);
      });
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

    console.log("Filtering results:");
    console.log("  Filter role:", filterRole);
    console.log("  Before filtering:", {
      students: users.students.length,
      tutors: users.tutors.length,
      admins: users.admins.length,
      principals: users.principals.length,
      total: allUsers.length
    });
    console.log("  After filtering:", allUsers.length);
    console.log("  Principals in filtered list:", allUsers.filter(u => u.role === 'principal').length);

    return allUsers;
  }, [users.students, users.tutors, users.admins, users.principals, searchTerm, filterRole, sortField, sortDirection]);
  
  const exportToExcel = () => {
    if (!filteredUsers.length) return;

    const headers = [
      "ID",
      "Full Name",
      "Email",
      "Role",
      "Joined Date",
      "Credits",
      "Profile Status",
      "District/School",
      "School Type",
      "Contact",
      "Address",
      "School Count"
    ];

    const rows = filteredUsers.map((u) => [
      u.id || u.user_id,
      u.name || "Unknown",
      u.email || "N/A",
      u.role || "N/A",
      new Date(u.created_at).toLocaleDateString(),
      u.credits || 0,
      u.has_profile ? "Complete" : "Incomplete",
      u.district_school_name || "N/A",
      u.type_of_school || "N/A",
      u.contact_number || "N/A",
      u.address || "N/A",
      u.school_count || 0
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Add some column widths
    const wscols = [
      { wch: 15 }, // ID
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 12 }, // Role
      { wch: 15 }, // Joined
      { wch: 10 }, // Credits
      { wch: 15 }, // Profile
      { wch: 30 }, // District
      { wch: 15 }, // School Type
      { wch: 15 }, // Contact
      { wch: 30 }, // Address
      { wch: 12 }, // School Count
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, `Users_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (!filteredUsers.length) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("User Management Report", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Role Filter: ${filterRole.toUpperCase()}`, 14, 35);
    
    if (searchTerm) {
      doc.text(`Search Term: "${searchTerm}"`, 14, 40);
    }

    const tableData = filteredUsers.map((u) => [
      u.name || "Unknown",
      u.email || "N/A",
      u.role || "N/A",
      new Date(u.created_at).toLocaleDateString(),
      u.credits || 0,
    ]);

    autoTable(doc, {
      startY: 45,
      head: [["Name", "Email", "Role", "Joined", "Credits"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save(`Users_Export_${new Date().toISOString().split('T')[0]}.pdf`);
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
    // If user is a tutor, fetch their payment details
    if (user.role === 'tutor') {
      try {
        setLoading(true);
        // Try to find the tutor entry
        // We might have user_id (from auth) or id (from Tutors table)
        // The list already has mixed IDs depending on source, but let's try to be robust
        
        let tutorQuery = supabase.from('Tutors').select('*');
        
        if (user.id && user.role === 'tutor') {
           // If we have the direct ID from the Tutors table (which mapUser tries to ensure for direct queries)
           // But remember mapUser sets id = u.id. 
           // If fetched from Tutors table directly, id is the UUID from Tutors table.
           // If fetched via RPC/Users, it might be the user_id. 
           // Let's rely on user_id if present, or id.
           
           if (user.user_id) {
             tutorQuery = tutorQuery.eq('user_id', user.user_id);
           } else {
             tutorQuery = tutorQuery.eq('id', user.id);
           }
        }
        
        const { data: tutorData, error } = await tutorQuery.single();
        
        if (!error && tutorData) {
            // Merge payment details into the user object for viewing
            const enrichedUser = {
                ...user,
                payment_method: tutorData.payment_method,
                bank_account_name: tutorData.bank_account_name,
                bank_account_number: tutorData.bank_account_number,
                bank_name: tutorData.bank_name,
                bank_branch: tutorData.bank_branch,
                paypal_email: tutorData.paypal_email,
                gcash_number: tutorData.gcash_number,
                gcash_name: tutorData.gcash_name
            };
            setViewingUser(enrichedUser);
            setLoading(false);
            return;
        }
      } catch (err) {
        console.error("Error fetching tutor details:", err);
      } finally {
        setLoading(false);
      }
    }
    
    setViewingUser(user);
    setCreditAmount("");
    setCreditMessage(null);
  };

  const handleCreditUpdate = async () => {
    if (!creditAmount || isNaN(creditAmount) || Number(creditAmount) <= 0) {
      setCreditMessage({ type: 'error', text: 'Please enter a valid amount greater than 0.' });
      return;
    }

    setIsUpdatingCredits(true);
    setCreditMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const response = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: viewingUser.user_id, // Use user_id for auth consistency
          role: viewingUser.role,
          amount: Number(creditAmount),
          type: creditType,
          adminId: user.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update credits');
      }

      // Update local state
      const updatedUser = { ...viewingUser, credits: data.newCredits };
      setViewingUser(updatedUser);
      
      // Update the main list as well so it reflects without refresh
      setUsers(prev => {
        const roleKey = viewingUser.role + 's'; // simple pluralization: students, tutors...
        // But role key mapping in state is: students, tutors, principals, admins
        let stateKey = '';
        if (viewingUser.role === 'student') stateKey = 'students';
        else if (viewingUser.role === 'tutor') stateKey = 'tutors';
        else if (viewingUser.role === 'principal') stateKey = 'principals';
        
        if (stateKey && prev[stateKey]) {
           const newList = prev[stateKey].map(u => 
             u.user_id === viewingUser.user_id ? { ...u, credits: data.newCredits } : u
           );
           return { ...prev, [stateKey]: newList };
        }
        return prev;
      });

      setCreditMessage({ type: 'success', text: `Successfully ${creditType === 'add' ? 'added' : 'removed'} ${creditAmount} credits.` });
      setCreditAmount(""); // Clear input on success
      
      // Auto-dismiss message after 3 seconds
      setTimeout(() => {
        setCreditMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Credit update error:", error);
      setCreditMessage({ type: 'error', text: error.message || "Failed to update credits." });
    } finally {
      setIsUpdatingCredits(false);
    }
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
            <button
              onClick={exportToExcel}
              disabled={filteredUsers.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={18} />
              <span className="hidden md:inline">Excel</span>
            </button>
            <button
              onClick={exportToPDF}
              disabled={filteredUsers.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileType size={18} />
              <span className="hidden md:inline">PDF</span>
            </button>
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
              {filteredUsers.map((user, index) => (
                <tr key={`${user.role}-${user.id || user.user_id || index}-${index}`} className="hover:bg-slate-50">
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
                      View info
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
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
              {(viewingUser.role === "student" || viewingUser.role === "principal" || viewingUser.role === "tutor") && (
                <div>
                  <p className="text-sm font-medium text-slate-500">Credits</p>
                  <p className="text-lg text-slate-900">
                    {parseFloat(viewingUser.credits || 0).toFixed(0)}
                  </p>
                </div>
              )}
              
              {/* Credit Management UI for Students, Tutors, and Principals */}
              {['student', 'tutor', 'principal'].includes(viewingUser.role) && (
                <div className="pt-4 mt-4 border-t border-slate-100">
                   <h3 className="text-md font-semibold text-slate-900 mb-3">Manage Credits</h3>
                   <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                      
                      {creditMessage && (
                        <div className={`p-3 rounded text-sm ${creditMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {creditMessage.text}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => setCreditType('add')}
                          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${creditType === 'add' 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                        >
                          Add Credits
                        </button>
                        <button
                          onClick={() => setCreditType('remove')}
                          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${creditType === 'remove' 
                            ? 'bg-red-100 text-red-700 border border-red-200' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                        >
                          Remove Credits
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                          min="1"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <button
                          onClick={handleCreditUpdate}
                          disabled={isUpdatingCredits || !creditAmount}
                          className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors ${
                             isUpdatingCredits || !creditAmount
                               ? 'bg-slate-400 cursor-not-allowed'
                               : creditType === 'add' 
                                 ? 'bg-green-600 hover:bg-green-700'
                                 : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {isUpdatingCredits ? 'Updating...' : creditType === 'add' ? 'Add' : 'Remove'}
                        </button>
                      </div>
                   </div>
                </div>
              )}
              {viewingUser.role === "principal" && (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Contact Number</p>
                    <p className="text-lg text-slate-900">
                      {viewingUser.contact_number || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Address</p>
                    <p className="text-lg text-slate-900">
                      {viewingUser.address || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Schools</p>
                    <p className="text-lg text-slate-900">
                      {viewingUser.school_count || 0} school(s)
                    </p>
                  </div>
                </>
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

                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <h3 className="text-md font-semibold text-slate-900 mb-3">Payment Information</h3>
                    
                    {viewingUser.payment_method ? (
                      <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Method</p>
                          <p className="text-base font-medium text-slate-900 capitalized">
                            {viewingUser.payment_method === 'bank' ? 'Bank Transfer' : 
                             viewingUser.payment_method === 'gcash' ? 'GCash' : 
                             viewingUser.payment_method === 'paypal' ? 'PayPal' : viewingUser.payment_method}
                          </p>
                        </div>

                        {viewingUser.payment_method === 'bank' && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bank Name</p>
                                <p className="text-sm text-slate-900">{viewingUser.bank_name || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Branch</p>
                                <p className="text-sm text-slate-900">{viewingUser.bank_branch || '-'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Account Name</p>
                              <p className="text-sm text-slate-900">{viewingUser.bank_account_name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Account Number</p>
                              <p className="font-mono text-sm text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                                {viewingUser.bank_account_number || '-'}
                              </p>
                            </div>
                          </>
                        )}

                        {viewingUser.payment_method === 'paypal' && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">PayPal Email</p>
                            <p className="text-sm text-slate-900">{viewingUser.paypal_email || '-'}</p>
                          </div>
                        )}

                        {viewingUser.payment_method === 'gcash' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">GCash Name</p>
                              <p className="text-sm text-slate-900">{viewingUser.gcash_name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">GCash Number</p>
                              <p className="font-mono text-sm text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                                {viewingUser.gcash_number || '-'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No payment information set.</p>
                    )}
                  </div>
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

