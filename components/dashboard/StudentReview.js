"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PROFILE_ID, getActiveProfile, buildPrimaryProfileName } from "@/lib/studentProfiles";

export default function StudentReview() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);
  const [parentName, setParentName] = useState("");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStudent = async () => {
      if (!user) return;
        const { data, error: err } = await supabase
          .from("Students")
          .select("id, name, first_name, last_name, extra_profiles, active_profile_id")
        .eq("user_id", user.id)
        .single();
      if (!err && data) {
        setStudentId(data.id);
        setStudentName(data.name || "");
          setStudentRecord(data);
      }
    };
  const activeProfile = studentRecord ? getActiveProfile(studentRecord) : null;
  const profileIdForReview =
    studentRecord?.active_profile_id || DEFAULT_PROFILE_ID;
  const profileNameForReview =
    activeProfile?.name ||
    (studentRecord ? buildPrimaryProfileName(studentRecord) : studentName || user?.email || "Primary Student");

    loadStudent();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess("");
    setError("");
    try {
      if (!message.trim()) {
        setError("Please enter your review message.");
        setSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase.from("Reviews").insert({
        student_user_id: user?.id || null,
        student_id: studentId,
        student_name: studentName || null,
        parent_name: parentName || null,
        rating: Number(rating) || null,
        message: message.trim(),
        profile_id: profileIdForReview,
        profile_name: profileNameForReview,
      });

      if (insertError) throw insertError;

      setSuccess("Your review has been sent to the admin.");
      setParentName("");
      setRating(5);
      setMessage("");
    } catch (err) {
      setError(err.message || "Failed to send review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold text-slate-900 mb-2">Parent Review</h2>
      <p className="text-slate-500">Parents can send feedback directly to the admin.</p>
      {profileNameForReview && (
        <p className="text-xs text-slate-500 mb-6">
          This review will be associated with <span className="font-medium">{profileNameForReview}</span>. Switch profiles in Student Settings if needed.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Parent Name (optional)</label>
          <input
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Jane Doe"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Rating</label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[5,4,3,2,1].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Write your review here..."
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {success && <div className="text-sm text-green-600">{success}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Sending..." : "Send Review"}
        </button>
      </form>
    </div>
  );
}



