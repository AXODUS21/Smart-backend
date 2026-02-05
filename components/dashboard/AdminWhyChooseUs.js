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
  Layout,
  Star,
} from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function AdminWhyChooseUs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    icon_name: "Star", // Default icon
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("cms_why_choose_us")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (!formData.title || !formData.description) {
        setError("Title and description are required");
        return;
      }

      if (editingId) {
        const { error } = await supabase
          .from("cms_why_choose_us")
          .update({
            title: formData.title,
            description: formData.description,
            icon_name: formData.icon_name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;
        setSuccess("Item updated successfully");
      } else {
        const { error } = await supabase.from("cms_why_choose_us").insert({
          title: formData.title,
          description: formData.description,
          icon_name: formData.icon_name,
        });

        if (error) throw error;
        setSuccess("Item created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ title: "", description: "", icon_name: "Star" });
      fetchItems();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error saving item:", error);
      setError(error.message || "Failed to save item");
    }
  };

  const handleEdit = (item) => {
    setFormData({
      title: item.title,
      description: item.description,
      icon_name: item.icon_name,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase
        .from("cms_why_choose_us")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setSuccess("Item deleted successfully");
      setItems(items.filter((item) => item.id !== id));
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error deleting item:", error);
      setError(error.message || "Failed to delete item");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Why Choose Us
          </h2>
          <p className="text-slate-500">
            Manage the "Why Choose Us" section on the landing page
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ title: "", description: "", icon_name: "Star" });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {showForm ? "Cancel" : "Add Item"}
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingId(null);
          setFormData({ title: "", description: "", icon_name: "Star" });
          setError("");
        }}
        title={editingId ? "Edit Item" : "New Item"}
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Expert Tutors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Brief description..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Icon Name (Lucide React)
              </label>
              <input
                type="text"
                value={formData.icon_name}
                onChange={(e) =>
                  setFormData({ ...formData, icon_name: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Star, GraduationCap, Users"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use icon names from Lucide React library
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingId ? "Update" : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ title: "", description: "", icon_name: "Star" });
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
      </Modal>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Layout className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-4 flex-1">
                {item.description}
              </p>
              <div className="text-xs text-slate-400">
                Icon: {item.icon_name}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              No items found. Add one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
