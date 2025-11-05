"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export default function AdminSubjects() {
  const [selectedGrade, setSelectedGrade] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subjectcatalog")
        .select("id, grade_level, subject, active")
        .order("grade_level", { ascending: true })
        .order("subject", { ascending: true });
      if (error) throw error;
      setSubjects(data || []);
    } catch (e) {
      console.error(e);
      setError("Failed to load subjects");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const gradeOptions = useMemo(() => {
    return Array.from(new Set((subjects || []).map((s) => s.grade_level))).filter(Boolean);
  }, [subjects]);

  const subjectsByGrade = useMemo(() => {
    const map = new Map();
    subjects.forEach((s) => {
      if (!map.has(s.grade_level)) map.set(s.grade_level, []);
      map.get(s.grade_level).push(s);
    });
    return map;
  }, [subjects]);

  const handleAddSubject = async () => {
    if (!selectedGrade.trim() || !newSubject.trim()) {
      setError("Enter grade level and subject name");
      setTimeout(() => setError(""), 2000);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("subjectcatalog")
        .insert({ grade_level: selectedGrade.trim(), subject: newSubject.trim(), active: true });
      if (error) throw error;
      setNewSubject("");
      await fetchSubjects();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to add subject");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row) => {
    try {
      const { error } = await supabase
        .from("subjectcatalog")
        .update({ active: !row.active })
        .eq("id", row.id);
      if (error) throw error;
      await fetchSubjects();
    } catch (e) {
      console.error(e);
      setError("Failed to update");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete subject "${row.subject}" from ${row.grade_level}?`)) return;
    try {
      const { error } = await supabase
        .from("subjectcatalog")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
      await fetchSubjects();
    } catch (e) {
      console.error(e);
      setError("Failed to delete");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subject Catalog</h1>
        <p className="text-gray-600">Control which subjects tutors can choose per grade level</p>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Grade Level</label>
            <input
              list="grade-options"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              placeholder="Type a grade level (e.g., High School (9-12))"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <datalist id="grade-options">
              {gradeOptions.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Type a subject (e.g., Algebra II)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddSubject}
              disabled={saving}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : (
          Array.from(new Set((subjects || []).map((s) => s.grade_level))).map((g) => (
            <div key={g} className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{g}</h3>
              <div className="space-y-2">
                {(subjectsByGrade.get(g) || []).map((row) => (
                  <div key={row.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{row.subject}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${row.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleActive(row)} className="px-2 py-1 text-gray-700 hover:text-gray-900">
                        {row.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => handleDelete(row)} className="px-2 py-1 text-red-600 hover:text-red-700">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                {(subjectsByGrade.get(g) || []).length === 0 && (
                  <div className="text-sm text-gray-500">No subjects added for this grade yet.</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
