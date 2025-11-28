"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Shield, Eye, EyeOff, X } from "lucide-react";

export default function StudentProfile({ studentModeEnabled, onChangeStudentMode, onCancel }) {
  const { user } = useAuth();
  const STATIC_QUESTION = "What is the name of your favorite book from childhood?";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [studentRecord, setStudentRecord] = useState(null);
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
          .select("id, user_id, student_pin, student_security_question, student_security_answer, name, email, pricing_region")
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

  const handleToggleStudentMode = async () => {
    setError("");
    setSuccess("");
    if (!hasPin) return; // No popup here; it shows on profile open
    // When pin exists, prompt for it prior to toggling
    setShowPinPrompt(true);
  };

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


