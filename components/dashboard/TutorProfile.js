"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Save, Plus, X } from "lucide-react";

export default function TutorProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Form state
  const [bio, setBio] = useState("");
  const [experiences, setExperiences] = useState([]);
  const [newExperience, setNewExperience] = useState({ title: "", company: "", duration: "", description: "" });
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [certifications, setCertifications] = useState([]);
  const [newCertification, setNewCertification] = useState("");

  const allSubjects = [
    "Mathematics",
    "Physics",
    "Chemistry",
    "English",
    "Biology",
    "History",
    "Computer Science",
    "Economics",
    "Geography",
    "Spanish",
    "French",
    "German",
    "Art",
    "Music",
    "Physical Education",
    "Statistics",
    "Calculus",
    "Algebra",
    "Geometry",
    "Trigonometry",
    "Literature",
    "Psychology",
  ];

  const gradeLevels = [
    "Elementary (K-5)",
    "Middle School (6-8)",
    "High School (9-12)",
    "College/University",
    "All Levels",
  ];

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
          setBio(tutorData?.bio || "");
          setExperiences(tutorData?.experience || []);
          setSkills(tutorData?.skills || []);
          setPhotoUrl(tutorData?.photo_url || "");
          setSubjects(tutorData?.subjects || []);
          setGradeLevel(tutorData?.grade_level || "");
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

  // Add subject
  const handleAddSubject = () => {
    if (!newSubject || subjects.includes(newSubject)) {
      setError("Please select a subject that isn't already added");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setSubjects([...subjects, newSubject]);
    setNewSubject("");
    setError("");
  };

  // Remove subject
  const handleRemoveSubject = (subjectToRemove) => {
    setSubjects(subjects.filter((subject) => subject !== subjectToRemove));
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

  // Save profile
  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("Tutors")
        .update({
          bio,
          experience: experiences,
          skills,
          photo_url: photoUrl,
          subjects,
          grade_level: gradeLevel,
          certifications,
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess("Profile saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setError("Error saving profile. Please try again.");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Profile Settings</h2>
          <p className="text-slate-500 mt-1">Manage your tutor profile information</p>
        </div>
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save Profile"}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bio */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Bio</h3>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell students about yourself, your teaching style, and what makes you a great tutor..."
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
            rows={5}
          />
        </div>

        {/* Photo URL */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Profile Photo</h3>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
          />
          {photoUrl && (
            <div className="mt-4">
              <img
                src={photoUrl}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-2 border-slate-200"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* Grade Level */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Grade Level</h3>
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="">Select grade level...</option>
            {gradeLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        {/* Subjects */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Subjects</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {subjects.map((subject) => (
              <span
                key={subject}
                className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {subject}
                <button
                  onClick={() => handleRemoveSubject(subject)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            >
              <option value="">Add a subject...</option>
              {allSubjects
                .filter((s) => !subjects.includes(s))
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
            <button
              onClick={handleAddSubject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
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
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
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
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Experience</h3>
          <div className="space-y-4 mb-4">
            {experiences.map((exp) => (
              <div
                key={exp.id}
                className="p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{exp.title}</h4>
                    <p className="text-sm text-slate-600">{exp.company}</p>
                    {exp.duration && (
                      <p className="text-sm text-slate-500">{exp.duration}</p>
                    )}
                    {exp.description && (
                      <p className="text-sm text-slate-700 mt-2">{exp.description}</p>
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
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
            />
            <input
              type="text"
              value={newExperience.company}
              onChange={(e) =>
                setNewExperience({ ...newExperience, company: e.target.value })
              }
              placeholder="Company/Organization"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
            />
            <input
              type="text"
              value={newExperience.duration}
              onChange={(e) =>
                setNewExperience({ ...newExperience, duration: e.target.value })
              }
              placeholder="Duration (e.g., 2020-2023)"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
            />
            <textarea
              value={newExperience.description}
              onChange={(e) =>
                setNewExperience({ ...newExperience, description: e.target.value })
              }
              placeholder="Description (optional)"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
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
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-500"
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

