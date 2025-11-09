"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Settings, Eye, EyeOff, ArrowUp, ArrowDown, Save } from "lucide-react";

export default function SuperadminSidebarConfig({ onConfigUpdate }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_sidebar_config")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error("Error fetching sidebar config:", error);
      setError("Failed to load sidebar configuration");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (id, isVisible) => {
    try {
      const { error } = await supabase
        .from("admin_sidebar_config")
        .update({ is_visible: !isVisible, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await fetchConfigs();
      if (onConfigUpdate) onConfigUpdate();
    } catch (error) {
      console.error("Error updating visibility:", error);
      setError("Failed to update visibility");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleMoveOrder = async (id, direction) => {
    const currentIndex = configs.findIndex((c) => c.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= configs.length) return;

    const updatedConfigs = [...configs];
    const temp = updatedConfigs[currentIndex].display_order;
    updatedConfigs[currentIndex].display_order = updatedConfigs[newIndex].display_order;
    updatedConfigs[newIndex].display_order = temp;

    setConfigs(updatedConfigs);

    try {
      const updates = [
        supabase
          .from("admin_sidebar_config")
          .update({ display_order: updatedConfigs[currentIndex].display_order, updated_at: new Date().toISOString() })
          .eq("id", updatedConfigs[currentIndex].id),
        supabase
          .from("admin_sidebar_config")
          .update({ display_order: updatedConfigs[newIndex].display_order, updated_at: new Date().toISOString() })
          .eq("id", updatedConfigs[newIndex].id),
      ];

      await Promise.all(updates);
      await fetchConfigs();
      if (onConfigUpdate) onConfigUpdate();
    } catch (error) {
      console.error("Error updating order:", error);
      setError("Failed to update order");
      setTimeout(() => setError(""), 3000);
      await fetchConfigs();
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updates = configs.map((config) =>
        supabase
          .from("admin_sidebar_config")
          .update({
            is_visible: config.is_visible,
            display_order: config.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id)
      );

      await Promise.all(updates);
      setSuccess("Configuration saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      if (onConfigUpdate) onConfigUpdate();
    } catch (error) {
      console.error("Error saving configuration:", error);
      setError("Failed to save configuration");
      setTimeout(() => setError(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Admin Sidebar Configuration
          </h2>
          <p className="text-slate-500">
            Control which tabs appear in the admin sidebar and their display order
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tab ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tab Label
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Visible
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {configs.map((config, index) => (
                <tr key={config.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {config.display_order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {config.tab_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {config.tab_label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleVisibility(config.id, config.is_visible)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                        config.is_visible
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                      }`}
                    >
                      {config.is_visible ? (
                        <>
                          <Eye className="w-4 h-4" />
                          Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Hidden
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMoveOrder(config.id, "up")}
                        disabled={index === 0}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveOrder(config.id, "down")}
                        disabled={index === configs.length - 1}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {configs.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-slate-200">
          <Settings className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">No sidebar configuration found</p>
        </div>
      )}
    </div>
  );
}

