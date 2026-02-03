"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Building2, Search, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrincipalSchools({ onSchoolsChange }) {
  const { user } = useAuth();
  const router = useRouter();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch schools
  useEffect(() => {
    const fetchSchools = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("Schools")
          .select("*")
          .eq("principal_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setSchools(data || []);
      } catch (error) {
        console.error("Error fetching schools:", error);
        setError("Failed to load schools");
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, [user]);

  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.voucher_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.school_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 className="text-2xl font-bold text-slate-900 mb-2">My Schools</h2>
          <p className="text-slate-600">
            Manage your schools. Each school can book sessions independently.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard?tab=manage-schools")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add School
        </button>
      </div>

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
            placeholder="Search schools by name, voucher code, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Schools List */}
      {filteredSchools.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 mb-2">
            {searchTerm ? "No schools found matching your search" : "No schools added yet"}
          </p>
          {!searchTerm && (
            <button
              onClick={() => router.push("/dashboard?tab=manage-schools")}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Add your first school
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchools.map((school) => (
            <div
              key={school.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 truncate">
                    {school.name}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">{school.school_type}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {school.voucher_code && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Voucher Code</span>
                    <span className="font-medium text-slate-900">{school.voucher_code}</span>
                  </div>
                )}
                {school.amount && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-medium text-green-600">
                      ₱{school.amount.toLocaleString()}
                    </span>
                  </div>
                )}
                {school.in_charge_name && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">In Charge</span>
                    <span className="font-medium text-slate-900 truncate ml-2">
                      {school.in_charge_name}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => router.push(`/dashboard?tab=manage-schools&school=${school.id}`)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-blue-100 p-2 rounded-full shrink-0">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">About School Profiles</h4>
            <p className="text-sm text-blue-800">
              Each school acts as an independent profile. You can book tutoring sessions for each school, 
              manage their schedules, and track their progress separately. To add or manage schools, 
              go to the "Manage Schools" tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
