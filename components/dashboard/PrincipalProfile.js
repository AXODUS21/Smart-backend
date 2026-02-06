"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  GraduationCap,
  Globe,
  Loader2,
} from "lucide-react";

export default function PrincipalProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("Principals")
          .select(
            "first_name, last_name, middle_name, email, contact_number, address, district_school_name, type_of_school, type_of_students, pricing_region"
          )
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error("Error fetching principal profile:", err);
        setError("Failed to load profile information.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
        {error}
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Principal Profile</h2>
        <p className="text-slate-600">View your registration information</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <User className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg text-slate-900">Personal Information</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-500 block mb-1">Full Name</label>
              <div className="text-slate-900 font-medium text-lg">
                {profile.first_name} {profile.middle_name ? `${profile.middle_name} ` : ""}{profile.last_name}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Address
                </label>
                <div className="text-slate-900">{profile.email}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Contact Number
                </label>
                <div className="text-slate-900">{profile.contact_number || "Not provided"}</div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Address
              </label>
              <div className="text-slate-900">{profile.address || "Not provided"}</div>
            </div>
          </div>
        </div>

        {/* Institution Information */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-lg text-slate-900">Institution Details</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-500 block mb-1">District / School Name</label>
              <div className="text-slate-900 font-medium text-lg">{profile.district_school_name}</div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-500 block mb-1">School Type</label>
              <div className="bg-indigo-50 inline-block px-3 py-1 rounded-full text-indigo-700 font-medium text-sm">
                {profile.type_of_school}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" /> Student Types Served
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.type_of_students && profile.type_of_students.length > 0 ? (
                  profile.type_of_students.map((type, idx) => (
                    <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm border border-slate-200">
                      {type}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic">No student types specified</span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 mt-2">
              <label className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Pricing Region
              </label>
              <div className="text-slate-900 flex items-center gap-2">
                {profile.pricing_region === "PH" ? (
                  <>
                    <span className="text-2xl">🇵🇭</span>
                    <span className="font-medium">Philippines</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🌏</span>
                    <span className="font-medium">International</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Determines credit pricing currency.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
