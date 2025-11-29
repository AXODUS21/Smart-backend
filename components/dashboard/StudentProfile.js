"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Shield, Eye, EyeOff, X, Users, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_PROFILE_ID,
  buildProfileOptions,
  getActiveProfile,
  createEmptyProfile,
  sanitizeProfiles,
  getExtraProfiles,
} from "@/lib/studentProfiles";

export default function StudentProfile({ studentModeEnabled, onChangeStudentMode, onCancel }) {
  const { user } = useAuth();
  const STATIC_QUESTION = "What is the name of your favorite book from childhood?";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [studentRecord, setStudentRecord] = useState(null);
  const [profileOptions, setProfileOptions] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(DEFAULT_PROFILE_ID);
  const [newProfile, setNewProfile] = useState(() => createEmptyProfile());
  const [profileSaving, setProfileSaving] = useState(false);
  const [pricingRegion, setPricingRegion] = useState("US");
  const [savingRegion, setSavingRegion] = useState(false);
  const [regionStatus, setRegionStatus] = useState({ type: null, message: "" });

  // PIN and security fields
  const [pin, setPin] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");

  // Modal controls
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [revealForgottenPin, setRevealForgottenPin] = useState("");
  const [forgotFlowOpen, setForgotFlowOpen] = useState(false);
  const [forgotAnswer, setForgotAnswer] = useState("");

  const hasPin = useMemo(() => Boolean(studentRecord?.student_pin), [studentRecord]);

  useEffect(() => {
    if (!user) return;
    const fetchStudent = async () => {
      try {
        const { data, error } = await supabase
          .from("Students")
          .select("id, user_id, student_pin, student_security_question, student_security_answer, name, email, pricing_region, first_name, last_name, extra_profiles, active_profile_id, has_family_pack")
          .eq("user_id", user.id)
          .single();
        if (error) throw error;
        setStudentRecord(data || null);
      } catch (e) {
        console.error("Error loading student profile:", e);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [user]);

  // Initialize form fields from record
  useEffect(() => {
    if (!studentRecord) return;
    setPin(studentRecord.student_pin || "");
    setSecurityQuestion(studentRecord.student_security_question || STATIC_QUESTION);
    setSecurityAnswer(studentRecord.student_security_answer || "");
    setPricingRegion(studentRecord.pricing_region === "PH" ? "PH" : "US");
  }, [studentRecord]);

  // If no PIN exists, show setup modal immediately when profile opens
  useEffect(() => {
    if (studentRecord && !studentRecord.student_pin) {
      setShowSetupModal(true);
    }
  }, [studentRecord]);

  useEffect(() => {
    if (!studentRecord) return;
    setProfileOptions(buildProfileOptions(studentRecord));
    setActiveProfileId(studentRecord.active_profile_id || DEFAULT_PROFILE_ID);
  }, [studentRecord]);

  const handleToggleStudentMode = async () => {
    setError("");
    setSuccess("");
    if (!hasPin) return; // No popup here; it shows on profile open
    // When pin exists, prompt for it prior to toggling
    setShowPinPrompt(true);
  };

  const handleProfileFieldChange = (field, value) => {
    setNewProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddProfile = async () => {
    setError("");
    setSuccess("");
    if (!studentRecord?.has_family_pack) {
      setError("You need to purchase a family pack to add additional profiles. Please visit the Credits page to purchase a family pack.");
      return;
    }
    if (!newProfile.name.trim()) {
      setError("Profile name is required");
      return;
    }
    setProfileSaving(true);
    try {
      const existing = getExtraProfiles(studentRecord);
      const updatedProfiles = sanitizeProfiles([
        ...existing,
        {
          ...newProfile,
        },
      ]);
      const { error } = await supabase
        .from("Students")
        .update({
          extra_profiles: updatedProfiles,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      setStudentRecord((prev) => ({
        ...(prev || {}),
        extra_profiles: updatedProfiles,
      }));
      setNewProfile(createEmptyProfile());
      setSuccess("Profile added");
    } catch (e) {
      console.error(e);
      setError("Failed to add profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRemoveProfile = async (profileId) => {
    setError("");
    setSuccess("");
    setProfileSaving(true);
    try {
      const existing = getExtraProfiles(studentRecord);
      const updatedProfiles = existing.filter((profile) => profile.id !== profileId);
      const updatePayload = {
        extra_profiles: updatedProfiles,
      };
      if (studentRecord.active_profile_id === profileId) {
        updatePayload.active_profile_id = null;
        setActiveProfileId(DEFAULT_PROFILE_ID);
      }
      const { error } = await supabase
        .from("Students")
        .update(updatePayload)
        .eq("user_id", user.id);
      if (error) throw error;
      setStudentRecord((prev) => ({
        ...(prev || {}),
        extra_profiles: updatedProfiles,
        active_profile_id: updatePayload.active_profile_id ?? prev?.active_profile_id,
      }));
      setSuccess("Profile removed");
    } catch (e) {
      console.error(e);
      setError("Failed to remove profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSetActiveProfile = async (profileId) => {
    setError("");
    setSuccess("");
    setProfileSaving(true);
    try {
      const nextValue = profileId === DEFAULT_PROFILE_ID ? null : profileId;
      const { error } = await supabase
        .from("Students")
        .update({
          active_profile_id: nextValue,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      setStudentRecord((prev) => ({
        ...(prev || {}),
        active_profile_id: nextValue,
      }));
      setActiveProfileId(profileId);
      setSuccess("Active profile updated");
    } catch (e) {
      console.error(e);
      setError("Failed to update active profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const activeProfileLabel = useMemo(() => {
    const activeProfile = getActiveProfile(studentRecord);
    return activeProfile?.name;
  }, [studentRecord]);

  const saveSetup = async () => {
    setError("");
    setSuccess("");
    if (!pin || pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    if (!securityQuestion || !securityAnswer) {
      setError("Security question and answer are required");
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from("Students")
        .update({
          student_pin: pin,
          student_security_question: STATIC_QUESTION,
          student_security_answer: securityAnswer,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      setStudentRecord((prev) => ({
        ...(prev || {}),
        student_pin: pin,
        student_security_question: STATIC_QUESTION,
        student_security_answer: securityAnswer,
      }));
      setShowSetupModal(false);
      setSuccess("PIN and security info saved");
    } catch (e) {
      console.error(e);
      setError("Failed to save setup");
    } finally {
      setSaving(false);
    }
  };

  const confirmPinAndToggle = () => {
    if (enteredPin !== (studentRecord?.student_pin || "")) {
      setError("Incorrect PIN");
      return;
    }
    setShowPinPrompt(false);
    onChangeStudentMode && onChangeStudentMode(!studentModeEnabled);
  };

  const handleForgot = () => {
    setForgotFlowOpen(true);
    setRevealForgottenPin("");
    setForgotAnswer("");
  };

  const verifyForgotAnswer = () => {
    if ((studentRecord?.student_security_answer || "").trim().toLowerCase() === (forgotAnswer || "").trim().toLowerCase()) {
      setRevealForgottenPin(studentRecord?.student_pin || "");
    } else {
      setRevealForgottenPin("");
      setError("Incorrect answer");
    }
  };

  const handleSavePricingRegion = async () => {
    if (!user || !studentRecord) return;
    const regionToSave = pricingRegion === "PH" ? "PH" : "US";
    setRegionStatus({ type: null, message: "" });
    try {
      setSavingRegion(true);
      const { error } = await supabase
        .from("Students")
        .update({ pricing_region: regionToSave })
        .eq("user_id", user.id);
      if (error) throw error;
      setStudentRecord((prev) => (prev ? { ...prev, pricing_region: regionToSave } : prev));
      setRegionStatus({
        type: "success",
        message: "Location saved. Credit pricing will use this setting.",
      });
    } catch (e) {
      console.error("Error saving pricing region:", e);
      setRegionStatus({
        type: "error",
        message: "Failed to save location. Please try again.",
      });
    } finally {
      setSavingRegion(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 border border-slate-200">Loading profile...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600" />
            <div>
              <div className="text-slate-900 font-semibold">Student Mode</div>
              <div className="text-slate-500 text-sm">When enabled, the navigation hides Buy Credits.</div>
            </div>
          </div>
          <button
            onClick={handleToggleStudentMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${studentModeEnabled ? "bg-blue-600" : "bg-slate-300"}`}
            aria-label="Toggle student mode"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${studentModeEnabled ? "translate-x-5" : "translate-x-1"}`}
            />
          </button>
        </div>
        <div className="mt-2 text-sm text-slate-600">Label: <span className="font-medium">student mode</span></div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="text-blue-600" />
            <div>
              <div className="text-slate-900 font-semibold">Family Profiles</div>
              <div className="text-slate-500 text-sm">
                Active profile: <span className="font-medium">{activeProfileLabel || "Primary"}</span>
              </div>
            </div>
          </div>
          {profileSaving && (
            <div className="text-sm text-slate-500">Saving...</div>
          )}
        </div>

        <div className="space-y-3">
          {profileOptions.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between border border-slate-200 rounded-lg p-3"
            >
              <div>
                <div className="font-medium text-slate-900">{profile.name}</div>
                <div className="text-xs text-slate-500">
                  {profile.isPrimary ? "Primary profile" : profile.grade_level ? `Grade ${profile.grade_level}` : "Family member"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSetActiveProfile(profile.id)}
                  disabled={activeProfileId === profile.id || profileSaving}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    activeProfileId === profile.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-700 hover:border-blue-300"
                  }`}
                >
                  {activeProfileId === profile.id ? "Active" : "Set Active"}
                </button>
                {!profile.isPrimary && (
                  <button
                    onClick={() => handleRemoveProfile(profile.id)}
                    className="p-2 rounded-full border border-transparent text-red-600 hover:bg-red-50"
                    disabled={profileSaving}
                    aria-label={`Remove ${profile.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-blue-600" />
            <div className="text-sm font-medium text-slate-900">Add Family Profile</div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={newProfile.name}
                onChange={(e) => handleProfileFieldChange("name", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. Sarah"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-600 mb-1">Grade Level</label>
              <input
                type="text"
                value={newProfile.grade_level || ""}
                onChange={(e) => handleProfileFieldChange("grade_level", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="e.g. 4"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-600 mb-1">Notes</label>
              <input
                type="text"
                value={newProfile.notes || ""}
                onChange={(e) => handleProfileFieldChange("notes", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                placeholder="Optional"
              />
            </div>
          </div>
          {!studentRecord?.has_family_pack && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                You need to purchase a family pack to add additional profiles. Visit the Credits page to purchase one.
              </p>
            </div>
          )}
          <button
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60"
            onClick={handleAddProfile}
            disabled={profileSaving || !studentRecord?.has_family_pack}
          >
            <Plus className="w-4 h-4" />
            Save Profile
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 space-y-4">
        <div>
          <div className="text-slate-900 font-semibold">Pricing Location</div>
          <div className="text-slate-500 text-sm">Choose where you reside so credits show the correct pricing.</div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1">Select location</label>
            <select
              value={pricingRegion}
              onChange={(e) => {
                setPricingRegion(e.target.value);
                setRegionStatus({ type: null, message: "" });
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="PH">Philippines</option>
              <option value="US">International</option>
            </select>
          </div>
          <button
            onClick={handleSavePricingRegion}
            disabled={savingRegion || !studentRecord}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
          >
            {savingRegion ? "Saving..." : "Save Location"}
          </button>
        </div>
        {regionStatus.message && (
          <div
            className={`text-sm ${
              regionStatus.type === "error" ? "text-red-600" : "text-green-600"
            }`}
          >
            {regionStatus.message}
          </div>
        )}
      </div>

      {/* Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="font-semibold text-slate-900">Set PIN & Security Question</div>
              <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setShowSetupModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Create PIN</label>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Enter 4+ digit PIN"
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" onClick={() => setShowPin((v) => !v)}>
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Personal Security Question</label>
                <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-slate-800">
                  {STATIC_QUESTION}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Answer</label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="Type your answer"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border border-slate-300" onClick={() => { setShowSetupModal(false); onCancel && onCancel(); }}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={saveSetup} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Prompt Modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="font-semibold text-slate-900">Enter PIN</div>
              <button className="p-2 hover:bg-slate-100 rounded" onClick={() => setShowPinPrompt(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div>
                <label className="block text-sm text-slate-600 mb-1">PIN</label>
                <input
                  type="password"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="Enter your PIN"
                />
              </div>
              {!forgotFlowOpen && (
                <button className="text-sm text-blue-600" onClick={handleForgot}>Forgot PIN?</button>
              )}
              {forgotFlowOpen && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-600">{STATIC_QUESTION}</div>
                  <input
                    type="text"
                    value={forgotAnswer}
                    onChange={(e) => setForgotAnswer(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Type your answer"
                  />
                  <button className="px-3 py-2 rounded-lg bg-slate-800 text-white" onClick={verifyForgotAnswer}>Verify</button>
                  {revealForgottenPin && (
                    <div className="text-sm text-green-700">Your PIN: <span className="font-semibold">{revealForgottenPin}</span></div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border border-slate-300" onClick={() => { setShowPinPrompt(false); onCancel && onCancel(); }}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={confirmPinAndToggle}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


