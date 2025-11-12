"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  UploadCloud,
  XCircle,
  FileText,
} from "lucide-react";

const INITIAL_FORM = {
  fullName: "",
  email: "",
  phone: "",
  subjects: "",
  experience: "",
  qualifications: "",
  resumeFile: null,
};

const STATUS_BADGES = {
  approved: {
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Approved",
  },
  pending: {
    icon: Clock,
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Pending Review",
  },
  rejected: {
    icon: XCircle,
    bg: "bg-rose-50",
    text: "text-rose-700",
    label: "Rejected",
  },
};

export default function TutorApplication({ onApplicationStatusChange, tutorId: initialTutorId }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tutorId, setTutorId] = useState(initialTutorId || null);
  const [applicationApproved, setApplicationApproved] = useState(null);
  const [latestApplication, setLatestApplication] = useState(null);
  const [formValues, setFormValues] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const populateFromTutor = useCallback(
    (tutorRecord) => {
      if (!tutorRecord) return;
      setTutorId(tutorRecord.id);
      setApplicationApproved(Boolean(tutorRecord.application_status));
      onApplicationStatusChange?.(Boolean(tutorRecord.application_status));
      setFormValues((prev) => ({
        ...prev,
        fullName: tutorRecord.name || prev.fullName || user?.user_metadata?.full_name || "",
        email: tutorRecord.email || prev.email || user?.email || "",
      }));
    },
    [onApplicationStatusChange, user]
  );

  const fetchData = useCallback(
    async ({ skipStatusUpdate } = {}) => {
      if (!user) return;
      setError("");
      try {
        let resolvedTutorId = tutorId;

        if (!resolvedTutorId) {
          const { data: tutorRecord, error: tutorError } = await supabase
            .from("Tutors")
            .select("id, name, email, application_status")
            .eq("user_id", user.id)
            .maybeSingle();

          if (tutorError) throw tutorError;
          if (tutorRecord) {
            resolvedTutorId = tutorRecord.id;
            populateFromTutor(tutorRecord);
          }
        } else if (!skipStatusUpdate) {
          const { data: tutorRecord, error: tutorError } = await supabase
            .from("Tutors")
            .select("id, name, email, application_status")
            .eq("id", resolvedTutorId)
            .maybeSingle();
          if (tutorError) throw tutorError;
          if (tutorRecord) {
            populateFromTutor(tutorRecord);
          }
        }

        if (!resolvedTutorId) {
          setError("We could not find your tutor profile. Please contact support.");
          return;
        }

        const { data: applicationRows, error: applicationError } = await supabase
          .from("TutorApplications")
          .select(
            "id, tutor_id, status, resume_url, experience, qualifications, subjects, phone, submitted_at, notes, reviewed_at, reviewed_by, full_name, email"
          )
          .eq("tutor_id", resolvedTutorId)
          .order("submitted_at", { ascending: false })
          .limit(1);

        if (applicationError) throw applicationError;

        const latest = applicationRows?.[0] || null;
        setLatestApplication(latest);

        if (latest && latest.status !== "approved") {
          setFormValues((prev) => ({
            ...prev,
            fullName: latest.full_name || prev.fullName,
            email: latest.email || prev.email,
            phone: latest.phone || prev.phone,
            experience: latest.experience || prev.experience,
            qualifications: latest.qualifications || prev.qualifications,
            subjects:
              latest.subjects && Array.isArray(latest.subjects)
                ? latest.subjects.join(", ")
                : prev.subjects,
          }));
        }

        if (latest?.status === "approved" && !applicationApproved) {
          setApplicationApproved(true);
          onApplicationStatusChange?.(true);
        }
      } catch (fetchError) {
        console.error("Error loading tutor application:", fetchError);
        setError(fetchError.message || "Failed to load your application details.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, tutorId, applicationApproved, populateFromTutor, onApplicationStatusChange]
  );

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, fetchData]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (event) => {
    const files = event.target.files;
    if (files && files[0]) {
      setFormValues((prev) => ({
        ...prev,
        resumeFile: files[0],
      }));
    }
  };

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const uploadResume = async () => {
    if (!formValues.resumeFile || !tutorId) return null;
    const extension = formValues.resumeFile.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${extension}`;
    const storagePath = `tutor-applications/${fileName}`;
    const { data, error: uploadError } = await supabase.storage
      .from("assignments")
      .upload(storagePath, formValues.resumeFile, { upsert: true });
    if (uploadError) {
      throw uploadError;
    }
    return data?.path ? data.path : storagePath;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    if (!user || !tutorId) return;

    if (
      !formValues.fullName.trim() ||
      !formValues.email.trim() ||
      !formValues.phone.trim() ||
      !formValues.experience.trim() ||
      !formValues.qualifications.trim()
    ) {
      setError("Please complete all required fields before submitting.");
      return;
    }

    if (!formValues.resumeFile && !latestApplication?.resume_url) {
      setError("Please upload your resume.");
      return;
    }

    setSubmitting(true);
    try {
      const resumePath = formValues.resumeFile ? await uploadResume() : latestApplication.resume_url;
      const subjectsArray = formValues.subjects
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean);

      const insertPayload = {
        tutor_id: tutorId,
        user_id: user.id,
        full_name: formValues.fullName.trim(),
        email: formValues.email.trim(),
        phone: formValues.phone.trim(),
        experience: formValues.experience.trim(),
        qualifications: formValues.qualifications.trim(),
        subjects: subjectsArray.length ? subjectsArray : null,
        resume_url: resumePath,
        status: "pending",
      };

      const { error: insertError } = await supabase
        .from("TutorApplications")
        .insert(insertPayload);

      if (insertError) throw insertError;

      setSuccess("Application submitted successfully. We'll notify you once it's reviewed.");
      setFormValues((prev) => ({ ...prev, resumeFile: null }));
      await fetchData({ skipStatusUpdate: true });
    } catch (submitError) {
      console.error("Error submitting application:", submitError);
      setError(submitError.message || "Failed to submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleDownloadResume = async () => {
    resetMessages();
    if (!latestApplication?.resume_url) {
      setError("This application does not have an attached resume.");
      return;
    }

    const { data, error: signedUrlError } = await supabase.storage
      .from("assignments")
      .createSignedUrl(latestApplication.resume_url, 60 * 10);

    if (signedUrlError) {
      console.error("Error creating signed URL:", signedUrlError);
      setError("Unable to access resume at the moment. Please try again later.");
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const statusBadge = useMemo(() => {
    if (!latestApplication?.status) return null;
    const status = latestApplication.status;
    if (!STATUS_BADGES[status]) return null;
    const badge = STATUS_BADGES[status];
    const Icon = badge.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${badge.bg} ${badge.text}`}
      >
        <Icon className="h-4 w-4" />
        {badge.label}
      </span>
    );
  }, [latestApplication]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading application details...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Tutor Application
            </h2>
            <p className="text-slate-500 mt-1 max-w-2xl">
              Apply to become a verified tutor. Once your application is approved, you will gain
              full access to the tutor dashboard features.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Status
          </button>
        </div>

        {applicationApproved && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-emerald-800">Application Approved</h3>
                <p className="text-emerald-700 mt-1">
                  Congratulations! Your tutor application has been approved. You now have full
                  access to the tutor dashboard. Switch to the dashboard tab to get started.
                </p>
              </div>
            </div>
          </div>
        )}

        {!applicationApproved && statusBadge && (
          <div className="mt-6 flex items-center gap-4">
            <div>{statusBadge}</div>
            {latestApplication?.submitted_at && (
              <p className="text-sm text-slate-500">
                Submitted on{" "}
                {new Date(latestApplication.submitted_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        )}

        {!applicationApproved && latestApplication?.status === "rejected" && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-rose-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-rose-700">Application Denied</h3>
                <p className="text-rose-600 mt-1">
                  Unfortunately your application was not approved. Review the feedback below and you
                  may re-submit with updated information.
                </p>
                {latestApplication?.notes && (
                  <p className="mt-3 rounded-md bg-white px-4 py-3 text-sm text-rose-700 border border-rose-100">
                    {latestApplication.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!applicationApproved && latestApplication?.status === "pending" && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-6 w-6 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-amber-800">Under Review</h3>
                <p className="text-amber-700 mt-1">
                  Your application is currently being reviewed by our administrators. You will be
                  notified once a decision is made. You can update the information below if needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}
      </div>

      {!applicationApproved && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-6"
        >
          <h3 className="text-xl font-semibold text-slate-900">Application Details</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="fullName" className="text-sm font-medium text-slate-700">
                Full Name<span className="text-rose-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formValues.fullName}
                onChange={handleInputChange}
                className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Your full legal name"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email<span className="text-rose-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formValues.email}
                onChange={handleInputChange}
                className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                Phone Number<span className="text-rose-500">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formValues.phone}
                onChange={handleInputChange}
                className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="+63 900 000 0000"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="subjects" className="text-sm font-medium text-slate-700">
                Subjects You Can Teach
              </label>
              <input
                id="subjects"
                name="subjects"
                type="text"
                value={formValues.subjects}
                onChange={handleInputChange}
                className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Example: Mathematics, Physics, English"
              />
              <p className="text-xs text-slate-400">
                Separate multiple subjects with commas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="experience" className="text-sm font-medium text-slate-700">
                Teaching Experience<span className="text-rose-500">*</span>
              </label>
              <textarea
                id="experience"
                name="experience"
                rows={4}
                value={formValues.experience}
                onChange={handleInputChange}
                className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Describe your teaching background and relevant experience."
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="qualifications" className="text-sm font-medium text-slate-700">
                Qualifications & Certifications<span className="text-rose-500">*</span>
              </label>
              <textarea
                id="qualifications"
                name="qualifications"
                rows={4}
                value={formValues.qualifications}
                onChange={handleInputChange}
                className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="List your degrees, certifications, or relevant training."
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              Resume / CV<span className="text-rose-500">*</span>
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-200 px-6 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/50">
              <UploadCloud className="h-8 w-8 text-blue-500" />
              <span className="mt-2 text-sm font-medium text-slate-700">
                {formValues.resumeFile ? formValues.resumeFile.name : "Upload PDF or DOCX"}
              </span>
              <span className="mt-1 text-xs text-slate-400">Max 10 MB</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {latestApplication?.resume_url && !formValues.resumeFile && (
              <button
                type="button"
                onClick={handleDownloadResume}
                className="self-start text-sm text-blue-600 hover:text-blue-500 underline decoration-from-font"
              >
                Download previously uploaded resume
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">
              Submit your application when you are ready. Our team typically reviews applications
              within 2-3 business days.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {latestApplication ? "Update Application" : "Submit Application"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

