"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Save, Plus, X, Edit, User, Briefcase, Award, BookOpen, CheckCircle, Wallet, CreditCard, AlertCircle } from "lucide-react";
import { formatCreditsAsCurrency, CREDIT_TO_PHP_RATE, CREDIT_TO_USD_RATE } from "@/lib/currency";
import { ImageUpload } from "@/components/ImageUpload";

const PROFILE_PHOTOS_BUCKET = "profile-photos";

export default function TutorProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [tutorData, setTutorData] = useState(null);
  const [credits, setCredits] = useState(0);
  const [balanceInfo, setBalanceInfo] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({
    payment_method: "bank",
    bank_account_name: "",
    bank_account_number: "",
    bank_name: "",
    bank_branch: "",
    paypal_email: "",
    gcash_number: "",
    gcash_name: "",
  });
  const [isEditingPaymentInfo, setIsEditingPaymentInfo] = useState(false);
  const [stripeStatus, setStripeStatus] = useState({ isConnected: false, isOnboarded: false });
  const [connecting, setConnecting] = useState(false);
  const [stripeLoginLoading, setStripeLoginLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Form state
  const [bio, setBio] = useState("");
  const [experiences, setExperiences] = useState([]);
  const [newExperience, setNewExperience] = useState({
    title: "",
    company: "",
    duration: "",
    description: "",
  });
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoResetToken, setPhotoResetToken] = useState(0);
  const [subjects, setSubjects] = useState([]); // Array of {subject: string, grade_level: string}
  const [newSubject, setNewSubject] = useState("");
  const [newSubjectGradeLevel, setNewSubjectGradeLevel] = useState("");
  const [certifications, setCertifications] = useState([]);
  const [newCertification, setNewCertification] = useState("");
  const [catalog, setCatalog] = useState([]); // rows from subjectcatalog
  const [gradeLevels, setGradeLevels] = useState([]); // from catalog
  const [subjectsForSelectedGrade, setSubjectsForSelectedGrade] = useState([]);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data, error } = await supabase
          .from("subjectcatalog")
          .select("grade_level, subject")
          .eq("active", true);
        if (error) throw error;
        const rows = data || [];
        setCatalog(rows);
        const grades = Array.from(new Set(rows.map((r) => r.grade_level)));
        setGradeLevels(grades);
      } catch (e) {
        console.error("Error fetching subject catalog:", e);
      }
    };
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (!newSubjectGradeLevel) {
      setSubjectsForSelectedGrade([]);
      setNewSubject("");
      return;
    }
    const list = catalog
      .filter((r) => r.grade_level === newSubjectGradeLevel)
      .map((r) => r.subject)
      .sort((a, b) => a.localeCompare(b));
    setSubjectsForSelectedGrade(list);
    if (!list.includes(newSubject)) {
      setNewSubject("");
    }
  }, [newSubjectGradeLevel, catalog]);

  const allSubjects = undefined;

  // Removed hardcoded gradeLevels; we now use dynamic gradeLevels from catalog

  // Fetch tutor profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data: tutorData, error: tutorError } = await supabase
          .from("Tutors")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (tutorError) {
          console.error("Error fetching tutor profile:", tutorError);
        } else {
          setTutorData(tutorData);
          setFirstName(tutorData?.first_name || "");
          setLastName(tutorData?.last_name || "");
          // Initialize payment info state from DB so the UI reflects saved values
          setPaymentInfo({
            payment_method: tutorData?.payment_method || "bank",
            bank_account_name: tutorData?.bank_account_name || "",
            bank_account_number: tutorData?.bank_account_number || "",
            bank_name: tutorData?.bank_name || "",
            bank_branch: tutorData?.bank_branch || "",
            paypal_email: tutorData?.paypal_email || "",
            gcash_number: tutorData?.gcash_number || "",
            gcash_name: tutorData?.gcash_name || "",
          });
          setBio(tutorData?.bio || "");
          setExperiences(tutorData?.experience || []);
          setSkills(tutorData?.skills || []);
          setPhotoUrl(tutorData?.photo_url || "");
          setPhotoFile(null);
          setPhotoRemoved(false);
          setPhotoResetToken((prev) => prev + 1);
          // Handle both old format (text array) and new format (object array)
          const subjectsData = tutorData?.subjects || [];
          const normalizedSubjects = subjectsData.map((subj) => {
            if (typeof subj === "string") {
              return { subject: subj, grade_level: null };
            }
            return subj;
          });
          setSubjects(normalizedSubjects);
          setCertifications(tutorData?.certifications || []);

          // Calculate credits from completed sessions (review submitted)
          if (tutorData?.id) {
            // The Tutors.credits column is the absolute source of truth for the available balance.
            // It is updated by session completion, payouts, and rejections.
            setCredits(parseFloat(tutorData.credits || 0));
          } else {
            setCredits(parseFloat(tutorData?.credits || 0));
          }
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Fetch balance information
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user || !tutorData) return;

      setBalanceLoading(true);
      try {
        const response = await fetch(`/api/tutor/balance?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setBalanceInfo(data);
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
      } finally {
        setBalanceLoading(false);
      }
    };

    if (tutorData) {
      fetchBalance();
    }
  }, [user, tutorData]);

  // Check Stripe Status
  useEffect(() => {
    async function checkStripeStatus() {
        if (!user) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const res = await fetch('/api/stripe/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setStripeStatus(data);
            }
        } catch (e) {
            console.error("Failed to check stripe status", e);
        }
    }
    checkStripeStatus();
  }, [user]);

  // Check for Stripe redirect parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        setSuccess("Stripe account connected successfully!");
        setTimeout(() => setSuccess(""), 5000);
        // Clear the URL params without refreshing
        window.history.replaceState({}, document.title, window.location.pathname + "?tab=profile");
      } else if (params.get("refresh") === "true") {
        setError("Stripe onboarding was not completed. Please try again.");
        setTimeout(() => setError(""), 5000);
        window.history.replaceState({}, document.title, window.location.pathname + "?tab=profile");
      }
    }
  }, []);

  const handleConnectStripe = async () => {
    try {
        setConnecting(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        const res = await fetch('/api/stripe/connect', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.url) {
            window.location.href = data.url;
        } else {
            alert("Failed to get onboarding link: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        console.error("Connect error:", e);
        alert("Connection failed");
    } finally {
        setConnecting(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    try {
      setStripeLoginLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/stripe/login-link', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        alert('Failed to open Stripe Dashboard: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Stripe login link error:', e);
      alert('Failed to open Stripe Dashboard');
    } finally {
      setStripeLoginLoading(false);
    }
  };

  // Handle cash out
  // Cash out removed; payouts are automatic now.
  // Add experience
  const handleAddExperience = () => {
    if (!newExperience.title || !newExperience.company) {
      setError("Please fill in at least title and company");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setExperiences([...experiences, { ...newExperience, id: Date.now() }]);
    setNewExperience({ title: "", company: "", duration: "", description: "" });
    setError("");
  };

  // Remove experience
  const handleRemoveExperience = (id) => {
    setExperiences(experiences.filter((exp) => exp.id !== id));
  };

  // Add skill
  const handleAddSkill = () => {
    if (!newSkill.trim() || skills.includes(newSkill.trim())) {
      setError("Please enter a valid skill that isn't already added");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setSkills([...skills, newSkill.trim()]);
    setNewSkill("");
    setError("");
  };

  // Remove skill
  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleImageChange = (file) => {
    setSuccess("");
    setError("");

    if (file) {
      setPhotoFile(file);
      setPhotoRemoved(false);
    } else {
      setPhotoFile(null);
      setPhotoUrl("");
      setPhotoRemoved(true);
      setPhotoResetToken((prev) => prev + 1);
    }
  };

  // Add subject with grade level (immediately persist to DB)
  const handleAddSubject = async () => {
    if (!newSubject) {
      setError("Please select a subject");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (!newSubjectGradeLevel) {
      setError("Please select a grade level for this subject");
      setTimeout(() => setError(""), 3000);
      return;
    }
    // Check if this subject-grade combination already exists
    const exists = subjects.some(
      (s) => s.subject === newSubject && s.grade_level === newSubjectGradeLevel
    );
    if (exists) {
      setError("This subject-grade level combination is already added");
      setTimeout(() => setError(""), 3000);
      return;
    }
    const updated = [
      ...subjects,
      { subject: newSubject, grade_level: newSubjectGradeLevel },
    ];
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      const { error } = await supabase
        .from("Tutors")
        .update({ subjects: updated })
        .eq("user_id", user.id);
      if (error) throw error;
      setSubjects(updated);
      setNewSubject("");
      setNewSubjectGradeLevel("");
      setSuccess("Subject added.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      console.error("Error adding subject:", e);
      setError("Error adding subject. Please try again.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Remove subject (immediately persist to DB)
  const handleRemoveSubject = async (indexToRemove) => {
    const updated = subjects.filter((_, index) => index !== indexToRemove);
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      const { error } = await supabase
        .from("Tutors")
        .update({ subjects: updated })
        .eq("user_id", user.id);
      if (error) throw error;
      setSubjects(updated);
      setSuccess("Subject removed.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      console.error("Error removing subject:", e);
      setError("Error removing subject. Please try again.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Add certification
  const handleAddCertification = () => {
    if (!newCertification.trim()) {
      setError("Please enter a certification link");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setCertifications([...certifications, newCertification.trim()]);
    setNewCertification("");
    setError("");
  };

  // Remove certification
  const handleRemoveCertification = (index) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  // Reset form to original values
  const handleCancelEdit = () => {
    if (!tutorData) return;
    setBio(tutorData?.bio || "");
    setExperiences(tutorData?.experience || []);
    setSkills(tutorData?.skills || []);
    setFirstName(tutorData?.first_name || "");
    setLastName(tutorData?.last_name || "");
    setPhotoUrl(tutorData?.photo_url || "");
    setPhotoFile(null);
    setPhotoRemoved(false);
    setPhotoResetToken((prev) => prev + 1);
    const subjectsData = tutorData?.subjects || [];
    const normalizedSubjects = subjectsData.map((subj) => {
      if (typeof subj === "string") {
        return { subject: subj, grade_level: null };
      }
      return subj;
    });
    setSubjects(normalizedSubjects);
    setCertifications(tutorData?.certifications || []);
    setError("");
    setSuccess("");
    setIsEditing(false);
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    setSuccess("");
    setError("");

    try {
      let updatedPhotoUrl = photoUrl || null;
      const photoChanged = Boolean(photoFile) || photoRemoved;

      // Try to upload photo if provided
      if (photoFile) {
        try {
          const sanitizedFileName = photoFile.name
            .replace(/[^a-zA-Z0-9.-]/g, "_")
            .replace(/\s+/g, "_");
          const filePath = `tutor-photos/${
            user.id
          }_${Date.now()}_${sanitizedFileName}`;

          console.log("Uploading photo to path:", filePath);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(PROFILE_PHOTOS_BUCKET)
            .upload(filePath, photoFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("Photo upload failed:", uploadError);
            setError(`Photo upload failed: ${uploadError.message}. Profile will be saved without photo update.`);
            // Keep the existing photo URL so we don't lose it
            updatedPhotoUrl = photoUrl || null;
          } else {
            console.log("Photo uploaded successfully:", uploadData);
            const { data: publicUrlData } = supabase.storage
              .from(PROFILE_PHOTOS_BUCKET)
              .getPublicUrl(filePath);

            updatedPhotoUrl = publicUrlData?.publicUrl || filePath;
            console.log("Photo URL:", updatedPhotoUrl);
          }
        } catch (photoError) {
          console.error("Photo upload exception:", photoError);
          setError(`Photo upload error: ${photoError.message}. Profile will be saved without photo update.`);
          // Keep the existing photo URL so we don't lose it
          updatedPhotoUrl = photoUrl || null;
        }
      } else if (photoRemoved) {
        updatedPhotoUrl = null;
      }

      // First, verify the user has a tutor record
      const { data: existingTutor, error: checkError } = await supabase
        .from("Tutors")
        .select("id, user_id")
        .eq("user_id", user.id)
        .single();

      if (checkError || !existingTutor) {
        throw new Error("Tutor profile not found. Please contact support.");
      }

      // Prepare update data - always include photo_url if photo was changed
      const updateData = {};
      if (bio !== undefined) updateData.bio = bio;
      if (firstName !== undefined) updateData.first_name = firstName;
      if (lastName !== undefined) updateData.last_name = lastName;
      // Update the concatenated name field for legacy support
      updateData.name = `${firstName || ""} ${lastName || ""}`.trim();
      
      if (experiences !== undefined) updateData.experience = experiences;
      if (skills !== undefined) updateData.skills = skills;
      // Always include photo_url if photo was changed (uploaded, removed, or kept)
      if (photoChanged) {
        updateData.photo_url = updatedPhotoUrl;
        console.log("Including photo_url in update:", updatedPhotoUrl);
      }
      if (subjects !== undefined) updateData.subjects = subjects;
      if (certifications !== undefined) updateData.certifications = certifications;
      
      console.log("Update data being sent:", updateData);

      // Use the tutor ID for the update to ensure we're updating the correct record
      const { error: updateError, data: updateDataResult } = await supabase
        .from("Tutors")
        .update(updateData)
        .eq("id", existingTutor.id)
        .eq("user_id", user.id) // Double check with user_id
        .select();

      if (updateError) {
        console.error("Update error details:", updateError);
        console.error("Update data attempted:", updateData);
        console.error("User ID:", user.id);
        console.error("Tutor ID:", existingTutor.id);
        throw updateError;
      }

      if (photoChanged) {
        setPhotoFile(null);
        setPhotoRemoved(false);
        setPhotoUrl(updatedPhotoUrl || "");
        setPhotoResetToken((prev) => prev + 1);
      }

      // Update tutorData and exit edit mode
      const { data: updatedData } = await supabase
        .from("Tutors")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (updatedData) {
        setTutorData(updatedData);
      }

      setSuccess("Profile saved successfully!");
      setTimeout(() => {
        setSuccess("");
        setIsEditing(false);
      }, 1500);
    } catch (error) {
      console.error("Error saving profile:", error);
      setError(error.message || "Error saving profile. Please try again.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSaving(false);
    }
  };

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

  // Profile View Mode
  if (!isEditing) {
    const displayPhotoUrl = tutorData?.photo_url || "";
    const displayBio = tutorData?.bio || "";
    const displayExperiences = tutorData?.experience || [];
    const displaySkills = tutorData?.skills || [];
    const displaySubjects = tutorData?.subjects || [];
    const displayCertifications = tutorData?.certifications || [];

    // Normalize subjects for display
    const normalizedDisplaySubjects = displaySubjects.map((subj) => {
      if (typeof subj === "string") {
        return { subject: subj, grade_level: null };
      }
      return subj;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              My Profile
            </h2>
            <p className="text-slate-500 mt-1">
              View your tutor profile information
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Edit size={18} />
            Edit Profile
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Photo and Basic Info */}
          <div className="lg:col-span-1 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col items-center">
              {displayPhotoUrl ? (
                <img
                  src={displayPhotoUrl}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover border-4 border-slate-200 mb-4"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                  <User size={48} className="text-slate-400" />
                </div>
              )}
              <h3 className="text-xl font-semibold text-slate-900 mb-1">
                {tutorData 
                  ? `${tutorData.first_name || ''} ${tutorData.last_name || ''}`.trim() || "Tutor"
                  : "Tutor"}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  tutorData?.pricing_region === 'PH' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {tutorData?.pricing_region === 'PH' ? '🇵🇭 Philippines' : '🌐 International'}
                </span>
              </div>
            </div>
          </div>

          {/* Credits & Earnings */}
          <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="text-emerald-600" size={20} />
              <h3 className="text-lg font-semibold text-slate-900">Earnings & Credits</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg border border-emerald-200">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Available Credits</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {balanceInfo?.credits !== undefined ? balanceInfo.credits.toFixed(2) : credits.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  {tutorData?.pricing_region === 'PH' ? (
                    <>
                      <p className="text-sm text-slate-600 mb-1">Equivalent in PHP</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCreditsAsCurrency(balanceInfo?.credits !== undefined ? balanceInfo.credits : credits, "PH")}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">1 credit = ₱{CREDIT_TO_PHP_RATE} PHP</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 mb-1">Equivalent in USD</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCreditsAsCurrency(balanceInfo?.credits !== undefined ? balanceInfo.credits : credits, "US")}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">1 credit = ${CREDIT_TO_USD_RATE.toFixed(2)} USD</p>
                    </>
                  )}
                </div>
              </div>
              {/* Note about automatic payouts */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 mb-1">
                      Automatic payouts
                    </p>
                    <p className="text-xs text-amber-700">
                      Payouts are processed automatically on the 15th and the last day of each month. Ensure your payment information below is up to date.
                    </p>
                  </div>
                </div>
              </div>
              {/* Payment Account Balances hidden for tutors */}
            </div>
          </div>

          {/* Payout Settings Section */}
          <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
               <Wallet className="text-purple-600" size={20} />
               <h3 className="text-lg font-semibold text-slate-900">Payout Settings</h3>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 mb-2">
                  {stripeStatus && stripeStatus.isOnboarded 
                    ? "Your account is connected and ready to receive automatic payouts."
                    : "Connect your Stripe account to receive automatic payouts directly to your bank."}
                </p>
                {stripeStatus && stripeStatus.isOnboarded ? (
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle size={20} />
                    <span>Payouts Enabled</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                     {stripeStatus && stripeStatus.isConnected ? (
                         <>
                             <div className="flex items-center gap-2 text-amber-600 font-medium">
                                 <span>Setup Incomplete</span>
                             </div>
                         </>
                     ) : (
                         <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <span>Not Connected</span>
                         </div>
                     )}
                  </div>
                )}
              </div>

               {/* Connected Account Details */}
               {stripeStatus?.externalAccount?.bankName && (
                   <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                       <p className="text-slate-500 mb-1">Connected Payout Account:</p>
                       <div className="flex items-center gap-2 font-medium text-slate-700">
                           <div className="capitalize">{stripeStatus.externalAccount.bankName}</div>
                           <div>•••• {stripeStatus.externalAccount.last4}</div>
                           <div className="text-xs px-1.5 py-0.5 bg-slate-200 rounded text-slate-600 uppercase">
                               {stripeStatus.externalAccount.currency}
                           </div>
                       </div>
                   </div>
               )}
              <div className="flex gap-2 flex-wrap">
                {stripeStatus && stripeStatus.isOnboarded && (
                  <button
                    onClick={handleOpenStripeDashboard}
                    disabled={stripeLoginLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {stripeLoginLoading ? 'Opening...' : 'Open Stripe Dashboard ↗'}
                  </button>
                )}
                {stripeStatus && stripeStatus.isOnboarded && (
                  <button
                    onClick={async () => {
                      if (!window.confirm("Are you sure you want to disconnect your Stripe account? You will stop receiving automatic payouts.")) return;
                      
                      try {
                        setConnecting(true);
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        
                        const res = await fetch('/api/stripe/disconnect', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        
                        if (res.ok) {
                          setSuccess("Stripe account disconnected.");
                          setStripeStatus({ isConnected: false, isOnboarded: false });
                          setTimeout(() => setSuccess(""), 3000);
                        } else {
                          const data = await res.json();
                          alert("Failed to disconnect: " + (data.error || "Unknown error"));
                        }
                      } catch (e) {
                        console.error("Disconnect error:", e);
                        alert("Disconnect failed");
                      } finally {
                        setConnecting(false);
                      }
                    }}
                    disabled={connecting}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                )}
                <button
                onClick={handleConnectStripe}
                disabled={connecting || (stripeStatus && stripeStatus.isOnboarded)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  stripeStatus && stripeStatus.isOnboarded
                    ? "bg-slate-100 text-slate-500 cursor-default"
                    : "bg-[#635BFF] text-white hover:bg-[#5851E1]"
                }`}
              >
                {connecting ? (
                    "Loading..." 
                ) : (stripeStatus && stripeStatus.isOnboarded) ? (
                    "Connected"
                ) : (
                    <>
                        <span>Connect with</span>
                        <span className="font-bold">Stripe</span>
                    </>
                )}
              </button>
            </div>
          </div>
        </div>

          {/* Payment Information */}
          <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="text-blue-600" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">Payment Information</h3>
              </div>
              {!isEditingPaymentInfo && (
                <button
                  onClick={() => setIsEditingPaymentInfo(true)}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <Edit size={16} />
                  {paymentInfo.bank_account_number || paymentInfo.paypal_email || paymentInfo.gcash_number ? "Edit" : "Add"}
                </button>
              )}
            </div>

            {isEditingPaymentInfo ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentInfo.payment_method}
                    onChange={(e) => setPaymentInfo({ ...paymentInfo, payment_method: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="paypal">PayPal</option>
                    <option value="gcash">GCash</option>
                  </select>
                </div>

                {paymentInfo.payment_method === "bank" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Account Holder Name *
                      </label>
                      <input
                        type="text"
                        value={paymentInfo.bank_account_name}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, bank_account_name: e.target.value })}
                        placeholder="Enter account holder name"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Account Number *
                      </label>
                      <input
                        type="text"
                        value={paymentInfo.bank_account_number}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, bank_account_number: e.target.value })}
                        placeholder="Enter account number"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Bank Name *
                      </label>
                      <input
                        type="text"
                        value={paymentInfo.bank_name}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, bank_name: e.target.value })}
                        placeholder="e.g., BDO, BPI, Metrobank"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Branch (Optional)
                      </label>
                      <input
                        type="text"
                        value={paymentInfo.bank_branch}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, bank_branch: e.target.value })}
                        placeholder="Enter branch location"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                  </>
                )}

                {paymentInfo.payment_method === "paypal" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      PayPal Email *
                    </label>
                    <input
                      type="email"
                      value={paymentInfo.paypal_email}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, paypal_email: e.target.value })}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                )}

                {paymentInfo.payment_method === "gcash" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        GCash Mobile Number *
                      </label>
                      <input
                        type="text"
                        value={paymentInfo.gcash_number}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, gcash_number: e.target.value })}
                        placeholder="09XX XXX XXXX"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        GCash Account Name *
                      </label>
                      <input
                        type="text"
                        value={paymentInfo.gcash_name}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, gcash_name: e.target.value })}
                        placeholder="Enter account name"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const { error } = await supabase
                          .from("Tutors")
                          .update(paymentInfo)
                          .eq("user_id", user.id);
                        
                        if (error) throw error;
                        setSuccess("Payment information saved successfully!");
                        setIsEditingPaymentInfo(false);
                        setTimeout(() => setSuccess(""), 3000);
                        
                        // Refresh tutor data
                        const { data: updated } = await supabase
                          .from("Tutors")
                          .select("*")
                          .eq("user_id", user.id)
                          .single();
                        if (updated) {
                          setTutorData(updated);
                          setPaymentInfo({
                            payment_method: updated?.payment_method || "bank",
                            bank_account_name: updated?.bank_account_name || "",
                            bank_account_number: updated?.bank_account_number || "",
                            bank_name: updated?.bank_name || "",
                            bank_branch: updated?.bank_branch || "",
                            paypal_email: updated?.paypal_email || "",
                            gcash_number: updated?.gcash_number || "",
                            gcash_name: updated?.gcash_name || "",
                          });
                        }
                      } catch (error) {
                        setError(error.message || "Failed to save payment information");
                        setTimeout(() => setError(""), 3000);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingPaymentInfo(false);
                      // Reset to original values
                      setPaymentInfo({
                        payment_method: tutorData?.payment_method || "bank",
                        bank_account_name: tutorData?.bank_account_name || "",
                        bank_account_number: tutorData?.bank_account_number || "",
                        bank_name: tutorData?.bank_name || "",
                        bank_branch: tutorData?.bank_branch || "",
                        paypal_email: tutorData?.paypal_email || "",
                        gcash_number: tutorData?.gcash_number || "",
                        gcash_name: tutorData?.gcash_name || "",
                      });
                    }}
                    className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentInfo.payment_method === "bank" && paymentInfo.bank_account_number ? (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-900">Bank Transfer</p>
                    <p className="text-sm text-slate-600">{paymentInfo.bank_account_name}</p>
                    <p className="text-sm text-slate-600">{paymentInfo.bank_account_number}</p>
                    <p className="text-sm text-slate-600">{paymentInfo.bank_name}</p>
                    {paymentInfo.bank_branch && (
                      <p className="text-sm text-slate-600">{paymentInfo.bank_branch}</p>
                    )}
                  </div>
                ) : paymentInfo.payment_method === "paypal" && paymentInfo.paypal_email ? (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-900">PayPal</p>
                    <p className="text-sm text-slate-600">{paymentInfo.paypal_email}</p>
                  </div>
                ) : paymentInfo.payment_method === "gcash" && paymentInfo.gcash_number ? (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-900">GCash</p>
                    <p className="text-sm text-slate-600">{paymentInfo.gcash_name}</p>
                    <p className="text-sm text-slate-600">{paymentInfo.gcash_number}</p>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No payment information added yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <User className="text-blue-600" size={20} />
              <h3 className="text-lg font-semibold text-slate-900">About Me</h3>
            </div>
            {displayBio ? (
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {displayBio}
              </p>
            ) : (
              <p className="text-slate-400 italic">No bio added yet.</p>
            )}
          </div>

          {/* Subjects */}
          <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="text-blue-600" size={20} />
              <h3 className="text-lg font-semibold text-slate-900">Subjects & Grade Levels</h3>
            </div>
            {normalizedDisplaySubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {normalizedDisplaySubjects.map((subjectObj, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    {subjectObj.subject}
                    {subjectObj.grade_level && (
                      <span className="text-blue-600 ml-1">• {subjectObj.grade_level}</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No subjects added yet.</p>
            )}
          </div>

          {/* Skills */}
          {displaySkills.length > 0 && (
            <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="text-blue-600" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {displaySkills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {displayExperiences.length > 0 && (
            <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="text-blue-600" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">Experience</h3>
              </div>
              <div className="space-y-4">
                {displayExperiences.map((exp, index) => (
                  <div
                    key={exp.id || index}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <h4 className="font-semibold text-slate-900">{exp.title}</h4>
                    <p className="text-sm text-slate-600">{exp.company}</p>
                    {exp.duration && (
                      <p className="text-sm text-slate-500 mt-1">{exp.duration}</p>
                    )}
                    {exp.description && (
                      <p className="text-sm text-slate-700 mt-2">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {displayCertifications.length > 0 && (
            <div className="lg:col-span-3 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Award className="text-blue-600" size={20} />
                <h3 className="text-lg font-semibold text-slate-900">Certifications</h3>
              </div>
              <div className="space-y-2">
                {displayCertifications.map((cert, index) => (
                  <a
                    key={index}
                    href={cert}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-blue-600 hover:text-blue-800 text-sm truncate"
                  >
                    {cert}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Profile Edit Mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Profile Settings
          </h2>
          <p className="text-slate-500 mt-1">
            Manage your tutor profile information
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancelEdit}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Bio</h3>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell students about yourself, your teaching style, and what makes you a great tutor..."
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
            rows={5}
          />
        </div>

        {/* Profile Photo */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Profile Photo
          </h3>
          <ImageUpload
            onImageChange={handleImageChange}
            initialUrl={photoUrl || null}
            resetSignal={photoResetToken}
            className="max-w-sm"
          />
        </div>

        {/* Subjects with Grade Levels */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Subjects & Grade Levels
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Add subjects and specify the grade level for each one
          </p>
          <div className="space-y-2 mb-4">
            {subjects.length === 0 ? (
              <p className="text-slate-500 italic text-sm">
                No subjects added yet. Add subjects with their grade levels
                below.
              </p>
            ) : (
              subjects.map((subjectObj, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900">
                      {subjectObj.subject}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-sm text-slate-600">
                      {subjectObj.grade_level || "No grade level specified"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveSubject(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex gap-2">
              <select
                value={newSubjectGradeLevel}
                onChange={(e) => setNewSubjectGradeLevel(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              >
                <option value="">Select grade level...</option>
                {gradeLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                disabled={!newSubjectGradeLevel}
              >
                <option value="">Select a subject...</option>
                {subjectsForSelectedGrade.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddSubject}
              disabled={!newSubject || !newSubjectGradeLevel}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add Subject
            </button>
          </div>
        </div>

        {/* Skills */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Skills</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {skills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
              >
                {skill}
                <button
                  onClick={() => handleRemoveSkill(skill)}
                  className="text-purple-600 hover:text-purple-800"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddSkill()}
              placeholder="Enter a skill..."
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
            />
            <button
              onClick={handleAddSkill}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Experience */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Experience
          </h3>
          <div className="space-y-4 mb-4">
            {experiences.map((exp) => (
              <div
                key={exp.id}
                className="p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">
                      {exp.title}
                    </h4>
                    <p className="text-sm text-slate-600">{exp.company}</p>
                    {exp.duration && (
                      <p className="text-sm text-slate-500">{exp.duration}</p>
                    )}
                    {exp.description && (
                      <p className="text-sm text-slate-700 mt-2">
                        {exp.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveExperience(exp.id)}
                    className="text-red-600 hover:text-red-700 ml-4"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <input
              type="text"
              value={newExperience.title}
              onChange={(e) =>
                setNewExperience({ ...newExperience, title: e.target.value })
              }
              placeholder="Job Title"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
            />
            <input
              type="text"
              value={newExperience.company}
              onChange={(e) =>
                setNewExperience({ ...newExperience, company: e.target.value })
              }
              placeholder="Company/Organization"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
            />
            <input
              type="text"
              value={newExperience.duration}
              onChange={(e) =>
                setNewExperience({ ...newExperience, duration: e.target.value })
              }
              placeholder="Duration (e.g., 2020-2023)"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
            />
            <textarea
              value={newExperience.description}
              onChange={(e) =>
                setNewExperience({
                  ...newExperience,
                  description: e.target.value,
                })
              }
              placeholder="Description (optional)"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
              rows={2}
            />
            <button
              onClick={handleAddExperience}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add Experience
            </button>
          </div>
        </div>

        {/* Certifications */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Certification Links
          </h3>
          <div className="space-y-2 mb-4">
            {certifications.map((cert, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <a
                  href={cert}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm truncate flex-1"
                >
                  {cert}
                </a>
                <button
                  onClick={() => handleRemoveCertification(index)}
                  className="text-red-600 hover:text-red-700 ml-4"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={newCertification}
              onChange={(e) => setNewCertification(e.target.value)}
              placeholder="https://example.com/certification"
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-500"
            />
            <button
              onClick={handleAddCertification}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
