"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Save, Plus, X, Edit, User, Briefcase, Award, BookOpen, CheckCircle } from "lucide-react";
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
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

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

      if (photoFile) {
        const sanitizedFileName = photoFile.name
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .replace(/\s+/g, "_");
        const filePath = `tutor-photos/${
          user.id
        }_${Date.now()}_${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(PROFILE_PHOTOS_BUCKET)
          .upload(filePath, photoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            uploadError.message || "Failed to upload profile photo"
          );
        }

        const { data: publicUrlData } = supabase.storage
          .from(PROFILE_PHOTOS_BUCKET)
          .getPublicUrl(filePath);

        updatedPhotoUrl = publicUrlData?.publicUrl || filePath;
      } else if (photoRemoved) {
        updatedPhotoUrl = null;
      }

      const { error: updateError } = await supabase
        .from("Tutors")
        .update({
          bio,
          experience: experiences,
          skills,
          photo_url: updatedPhotoUrl,
          subjects,
          certifications,
        })
        .eq("user_id", user.id);

      if (updateError) {
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
                {tutorData?.name || user?.email || "Tutor"}
              </h3>
            </div>
          </div>

          {/* Bio */}
          <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
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
