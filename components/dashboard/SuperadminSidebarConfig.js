"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Settings, Eye, EyeOff, ArrowUp, ArrowDown, Save, User } from "lucide-react";

export default function SuperadminSidebarConfig({ onConfigUpdate }) {
  const [configs, setConfigs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Default tabs configuration
  const defaultTabs = [
    { tab_id: "home", tab_label: "Dashboard", is_visible: true, display_order: 1 },
    { tab_id: "analytics", tab_label: "Analytics", is_visible: true, display_order: 2 },
    { tab_id: "users", tab_label: "Users", is_visible: true, display_order: 3 },
    { tab_id: "jobs", tab_label: "Jobs", is_visible: true, display_order: 4 },
    { tab_id: "tasks", tab_label: "Tasks", is_visible: true, display_order: 5 },
    { tab_id: "subjects", tab_label: "Subjects", is_visible: true, display_order: 6 },
    { tab_id: "announcements", tab_label: "Announcements", is_visible: true, display_order: 7 },
    { tab_id: "parents-review", tab_label: "Parents Review", is_visible: true, display_order: 8 },
    { tab_id: "cms", tab_label: "CMS", is_visible: true, display_order: 9 },
    { tab_id: "voucher-requests", tab_label: "Voucher Requests", is_visible: true, display_order: 10 },
  ];

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    if (selectedAdminId) {
      fetchConfigs(selectedAdminId);
    } else {
      setConfigs([]);
      setLoading(false);
    }
  }, [selectedAdminId]);

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching admins:", error);
        throw error;
      }
      
      console.log("Fetched admins:", data); // Debug log
      setAdmins(data || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching admins:", error);
      setError(`Failed to load admins: ${error.message}`);
      setTimeout(() => setError(""), 5000);
      setLoading(false);
    }
  };

  const initializeDefaultConfig = async (adminId) => {
    try {
      // Convert adminId to number if it's a string
      const adminIdNum = typeof adminId === 'string' ? parseInt(adminId, 10) : adminId;
      
      // Check if config already exists
      const { data: existing } = await supabase
        .from("admin_sidebar_config")
        .select("id")
        .eq("admin_id", adminIdNum)
        .limit(1);

      if (existing && existing.length > 0) {
        // Config exists, just fetch it
        return;
      }

      // Create default configs for this admin
      const configsToInsert = defaultTabs.map((tab) => ({
        ...tab,
        admin_id: adminIdNum,
      }));

      const { error } = await supabase
        .from("admin_sidebar_config")
        .insert(configsToInsert);

      if (error) throw error;
    } catch (error) {
      console.error("Error initializing default config:", error);
      throw error;
    }
  };

  const ensureAllTabsPresent = async (adminIdNum, currentConfigs) => {
    const missingTabs = defaultTabs.filter(
      (tab) => !currentConfigs.some((config) => config.tab_id === tab.tab_id)
    );

    if (missingTabs.length === 0) {
      return currentConfigs;
    }

    let nextDisplayOrder =
      currentConfigs.length > 0
        ? Math.max(...currentConfigs.map((config) => config.display_order || 0)) + 1
        : 1;

    const tabsToInsert = missingTabs.map((tab) => ({
      admin_id: adminIdNum,
      tab_id: tab.tab_id,
      tab_label: tab.tab_label,
      is_visible: tab.is_visible,
      display_order:
        currentConfigs.length === 0 ? tab.display_order : nextDisplayOrder++,
    }));

    const { error } = await supabase.from("admin_sidebar_config").insert(tabsToInsert);

    if (error) {
      console.error("Error inserting missing tabs:", error);
      throw error;
    }

    const refreshedConfigs = [
      ...currentConfigs,
      ...tabsToInsert.map((tab, index) => ({
        ...tab,
        id: `temp-${tab.tab_id}-${index}`,
      })),
    ];

    return refreshedConfigs;
  };

  const fetchConfigs = async (adminId) => {
    setLoading(true);
    try {
      // Convert adminId to number if it's a string
      const adminIdNum = typeof adminId === 'string' ? parseInt(adminId, 10) : adminId;
      
      // Initialize default config if it doesn't exist
      await initializeDefaultConfig(adminIdNum);

      const { data, error } = await supabase
        .from("admin_sidebar_config")
        .select("*")
        .eq("admin_id", adminIdNum)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const configsWithAllTabs = await ensureAllTabsPresent(adminIdNum, data || []);

      // If we inserted new tabs, fetch again to get real IDs
      if ((data || []).length !== configsWithAllTabs.length) {
        const { data: refreshedData, error: refreshError } = await supabase
          .from("admin_sidebar_config")
          .select("*")
          .eq("admin_id", adminIdNum)
          .order("display_order", { ascending: true });

        if (refreshError) throw refreshError;
        setConfigs(refreshedData || []);
      } else {
        setConfigs(configsWithAllTabs);
      }
    } catch (error) {
      console.error("Error fetching sidebar config:", error);
      setError(`Failed to load sidebar configuration: ${error.message}`);
      setTimeout(() => setError(""), 5000);
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
      await fetchConfigs(selectedAdminId);
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
      await fetchConfigs(selectedAdminId);
      if (onConfigUpdate) onConfigUpdate();
    } catch (error) {
      console.error("Error updating order:", error);
      setError("Failed to update order");
      setTimeout(() => setError(""), 3000);
      await fetchConfigs(selectedAdminId);
    }
  };

  const handleSaveAll = async () => {
    if (!selectedAdminId) {
      setError("Please select an admin first");
      setTimeout(() => setError(""), 3000);
      return;
    }

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

  if (loading && !selectedAdminId) {
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
            Configure which tabs appear in each admin's sidebar
          </p>
        </div>
        {selectedAdminId && (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save All"}
          </button>
        )}
      </div>

      {/* Admin Selection */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select Admin to Configure
        </label>
        <select
          value={selectedAdminId}
          onChange={(e) => setSelectedAdminId(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2"
        >
          <option value="">-- Select an admin --</option>
          {admins.length === 0 ? (
            <option disabled>No admins found</option>
          ) : (
            admins.map((admin) => (
              <option key={admin.id} value={String(admin.id)}>
                {admin.name || admin.email} ({admin.email})
              </option>
            ))
          )}
        </select>
        {admins.length === 0 && !loading && (
          <p className="mt-2 text-sm text-red-600">
            No admins found. Please ensure there are admins in the database.
          </p>
        )}
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

      {selectedAdminId && (
        <>
          {loading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-48"></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="w-5 h-5" />
                  <span className="font-medium">
                    Configuring sidebar for:{" "}
                    {admins.find((a) => a.id === parseInt(selectedAdminId))?.name ||
                      admins.find((a) => a.id === parseInt(selectedAdminId))?.email}
                  </span>
                </div>
              </div>
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
          )}

          {configs.length === 0 && !loading && (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-slate-200">
              <Settings className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No sidebar configuration found for this admin</p>
            </div>
          )}
        </>
      )}

      {!selectedAdminId && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-slate-200">
          <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">Please select an admin to configure their sidebar</p>
        </div>
      )}
    </div>
  );
}
