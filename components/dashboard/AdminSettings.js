"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Settings, Save, Upload, FileText, Check, AlertCircle } from "lucide-react";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", content: "" });
  const [settings, setSettings] = useState({
    school_registration_template: null
  });

  const SETTINGS_KEYS = {
    SCHOOL_TEMPLATE: "school_registration_template"
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("SystemSettings")
        .select("*")
        .in("key", Object.values(SETTINGS_KEYS));

      if (error) throw error;

      const newSettings = {};
      data?.forEach(item => {
        newSettings[item.key] = item.value;
      });

      setSettings(prev => ({ ...prev, ...newSettings }));
    } catch (error) {
      console.error("Error fetching settings:", error);
      setMessage({ type: "error", content: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, key) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage({ type: "", content: "" });

    try {
      // 1. Upload file
      const fileExt = file.name.split('.').pop();
      const fileName = `templates/${key}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("public-assets")
        .getPublicUrl(fileName);

      // 2. Update SystemSettings
      const value = { url: publicUrl, name: file.name, updated_at: new Date().toISOString() };
      
      // Check if row exists
      const { data: existing } = await supabase
        .from("SystemSettings")
        .select("id")
        .eq("key", key)
        .single();

      let updateError;
      if (existing) {
        const { error } = await supabase
          .from("SystemSettings")
          .update({ value })
          .eq("key", key);
        updateError = error;
      } else {
        const { error } = await supabase
          .from("SystemSettings")
          .insert({ key, value, description: "Template for school registration excel file" });
        updateError = error;
      }

      if (updateError) throw updateError;

      setSettings(prev => ({ ...prev, [key]: value }));
      setMessage({ type: "success", content: "Template updated successfully" });
    } catch (error) {
      console.error("Error updating template:", error);
      setMessage({ type: "error", content: error.message || "Failed to update template" });
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = null;
    }
  };

  if (loading) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Document Templates</h2>
        <p className="text-slate-600">
          Manage general system configurations and templates.
        </p>
      </div>

      {message.content && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {message.type === "success" ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.content}
        </div>
      )}

      {/* Templates Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Document Templates
          </h3>
        </div>
        
        <div className="p-6 space-y-6">
          {/* School Registration Template */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-slate-200 rounded-lg">
            <div className="flex-1">
              <h4 className="font-medium text-slate-900 mb-1">School Registration Excel Template</h4>
              <p className="text-sm text-slate-500 mb-2">
                This file is provided to Principals to download and fill out when adding a school.
              </p>
              {settings[SETTINGS_KEYS.SCHOOL_TEMPLATE]?.url ? (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Check className="w-4 h-4" />
                  <a 
                    href={settings[SETTINGS_KEYS.SCHOOL_TEMPLATE].url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Current file: {settings[SETTINGS_KEYS.SCHOOL_TEMPLATE].name}
                  </a>
                  <span className="text-slate-400 text-xs">
                    ({new Date(settings[SETTINGS_KEYS.SCHOOL_TEMPLATE].updated_at).toLocaleDateString()})
                  </span>
                </div>
              ) : (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> No template uploaded yet
                </p>
              )}
            </div>

            <div className="shrink-0">
              <label className={`
                flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors
                ${uploading 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400"
                }
              `}>
                <Upload className="w-4 h-4" />
                <span className="font-medium">{uploading ? "Uploading..." : "Upload New Template"}</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv"
                  disabled={uploading}
                  onChange={(e) => handleFileUpload(e, SETTINGS_KEYS.SCHOOL_TEMPLATE)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
