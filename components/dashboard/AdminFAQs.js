"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  X,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function AdminFAQs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    category: "Students",
    question: "",
    answer: "",
    display_order: 1,
  });

  const CATEGORIES = [
    "Students",
    "Tutors",
    "Parents",
    "Schools",
    "Partners",
  ];

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("cms_faqs")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      setError("Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (!formData.question || !formData.answer) {
        setError("Question and answer are required");
        return;
      }

      if (editingId) {
        const { error } = await supabase
          .from("cms_faqs")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;
        setSuccess("FAQ updated successfully");
      } else {
        const { error } = await supabase.from("cms_faqs").insert(formData);

        if (error) throw error;
        setSuccess("FAQ created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchItems();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error saving FAQ:", error);
      setError(error.message || "Failed to save FAQ");
    }
  };

  const resetForm = () => {
    setFormData({
      category: "Students",
      question: "",
      answer: "",
      display_order: 1,
    });
  };

  const handleEdit = (item) => {
    setFormData({
      category: item.category,
      question: item.question,
      answer: item.answer,
      display_order: item.display_order,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      const { error } = await supabase.from("cms_faqs").delete().eq("id", id);

      if (error) throw error;
      setSuccess("FAQ deleted successfully");
      setItems(items.filter((item) => item.id !== id));
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      setError(error.message || "Failed to delete FAQ");
    }
  };

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500">Manage FAQ content by category</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            resetForm();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {showForm ? "Cancel" : "Add FAQ"}
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => {
            setShowForm(false);
            setEditingId(null);
            resetForm();
        }}
        title={editingId ? "Edit FAQ" : "New FAQ"}
      >

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Order
                </label>
                <select
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      display_order: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {[1, 2, 3, 4, 5].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Question
              </label>
              <input
                type="text"
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Answer
              </label>
              <textarea
                value={formData.answer}
                onChange={(e) =>
                  setFormData({ ...formData, answer: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
      </Modal>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div
              key={category}
              className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">{category}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {categoryItems.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-8">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                            #{item.display_order}
                          </span>
                          <h4 className="font-medium text-slate-900">
                            {item.question}
                          </h4>
                        </div>
                        <p className="text-slate-600 text-sm">{item.answer}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="bg-white rounded-lg p-12 text-center text-slate-500 border border-slate-200 border-dashed">
              <HelpCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No FAQs found. Add your first FAQ to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
