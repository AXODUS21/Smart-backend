"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  RefreshCw,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";

const normalizeService = (service) => {
  return {
    dbId: service.id,
    icon: service.icon || "",
    title: service.title || "",
    description: service.description || "",
    // Store features as a comma-separated string in the UI
    featuresText: Array.isArray(service.features)
      ? service.features.join(", ")
      : service.features || "",
    sortOrder:
      typeof service.sort_order === "number"
        ? service.sort_order.toString()
        : "0",
    isActive: service.is_active ?? true,
    updatedAt: service.updated_at,
    original: {
      icon: service.icon || "",
      title: service.title || "",
      description: service.description || "",
      featuresText: Array.isArray(service.features)
        ? service.features.join(", ")
        : service.features || "",
      sortOrder:
        typeof service.sort_order === "number"
          ? service.sort_order.toString()
          : "0",
      isActive: service.is_active ?? true,
    },
  };
};

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingServiceId, setSavingServiceId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError("");
      const { data, error: fetchError } = await supabase
        .from("landing_services")
        .select(
          "id, icon, title, description, features, sort_order, is_active, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setServices((data || []).map(normalizeService));
    } catch (err) {
      console.error("Error loading services:", err);
      setError(
        err?.message ||
          "Failed to load services. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleFieldChange = (serviceId, field, value) => {
    setDirty(true);
    setServices((prev) =>
      prev.map((service) =>
        service.dbId === serviceId
          ? {
              ...service,
              [field]: value,
            }
          : service
      )
    );
  };

  const handleToggleActive = (serviceId, value) => {
    setDirty(true);
    setServices((prev) =>
      prev.map((service) =>
        service.dbId === serviceId
          ? {
              ...service,
              isActive: value,
            }
          : service
      )
    );
  };

  const hasChanges = (service) =>
    service.icon !== service.original.icon ||
    service.title !== service.original.title ||
    service.description !== service.original.description ||
    service.featuresText !== service.original.featuresText ||
    service.sortOrder !== service.original.sortOrder ||
    service.isActive !== service.original.isActive;

  const handleReset = (serviceId) => {
    setDirty(false);
    setServices((prev) =>
      prev.map((service) =>
        service.dbId === serviceId
          ? {
              ...service,
              ...service.original,
              isActive: service.original.isActive,
            }
          : service
      )
    );
  };

  const handleSave = async (service) => {
    try {
      setError("");
      setSuccess("");

      const trimmedTitle = (service.title || "").trim();
      if (!trimmedTitle) {
        setError("Title is required.");
        return;
      }

      const trimmedIcon = (service.icon || "").trim();
      if (!trimmedIcon) {
        setError(
          "Icon is required (store the icon name like BookOpen, Users, Target, etc.)."
        );
        return;
      }

      const parsedSortOrder = Number.parseInt(service.sortOrder || "0", 10);
      const finalSortOrder = Number.isFinite(parsedSortOrder)
        ? parsedSortOrder
        : 0;

      // Convert featuresText -> text[]
      const featuresArray = (service.featuresText || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      setSavingServiceId(service.dbId || "new");

      const updates = {
        icon: trimmedIcon,
        title: trimmedTitle,
        description: service.description || "",
        features: featuresArray,
        sort_order: finalSortOrder,
        is_active: service.isActive,
      };

      const updatedAt = new Date().toISOString();
      updates.updated_at = updatedAt;

      const { data, error: upsertError } = await supabase
        .from("landing_services")
        .upsert(
          {
            ...updates,
            id: service.dbId || undefined,
          },
          {
            onConflict: "id",
          }
        )
        .select(
          "id, icon, title, description, features, sort_order, is_active, updated_at"
        )
        .single();

      if (upsertError) {
        throw upsertError;
      }

      const normalized = normalizeService(data);

      setServices((prev) =>
        prev.map((item) =>
          item.dbId === service.dbId
            ? normalized
            : item
        )
      );
      setDirty(false);

      setSuccess("Service saved successfully.");
    } catch (err) {
      console.error("Failed to save service:", err);
      setError(err?.message || "Failed to save service. Please try again.");
    } finally {
      setSavingServiceId(null);
    }
  };

  const handleAddNew = () => {
    setDirty(true);
    const nextSort =
      services.length > 0
        ? Math.max(
            ...services.map((svc) =>
              Number.parseInt(svc.sortOrder || "0", 10)
            )
          ) + 1
        : 1;
    const newService = {
      dbId: `new-${Date.now()}`,
      icon: "",
      title: "",
      description: "",
      featuresText: "",
      sortOrder: nextSort.toString(),
      isActive: true,
      updatedAt: null,
      original: {
        icon: "",
        title: "",
        description: "",
        featuresText: "",
        sortOrder: nextSort.toString(),
        isActive: true,
      },
    };
    setServices((prev) => [newService, ...prev]);
  };

  const handleDelete = async (serviceId) => {
    const target = services.find((svc) => svc.dbId === serviceId);
    if (!target) return;

    // If it's a new unsaved service, just remove it from UI
    if (typeof target.dbId === "string" && target.dbId.startsWith("new-")) {
      setServices((prev) => prev.filter((svc) => svc.dbId !== serviceId));
      return;
    }

    try {
      setError("");
      setSuccess("");
      const { error: deleteError } = await supabase
        .from("landing_services")
        .delete()
        .eq("id", serviceId);

      if (deleteError) {
        throw deleteError;
      }

      setServices((prev) => prev.filter((svc) => svc.dbId !== serviceId));
      setSuccess("Service deleted.");
    } catch (err) {
      console.error("Failed to delete service:", err);
      setError(err?.message || "Failed to delete service. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Landing Services</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Service
          </button>
          <button
            onClick={fetchServices}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-2/3 rounded bg-slate-200"></div>
                <div className="h-10 rounded bg-slate-200"></div>
                <div className="h-6 rounded bg-slate-200"></div>
                <div className="h-6 rounded bg-slate-200"></div>
              </div>
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
          No services found. Click &quot;Add Service&quot; to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.dbId}
              className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {service.icon || "Icon name"}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900">
                    {service.title || "Service title"}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    service.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {service.isActive ? "Active" : "Hidden"}
                </span>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-600">
                  Icon Name
                  <input
                    type="text"
                    value={service.icon}
                    onChange={(event) =>
                      handleFieldChange(
                        service.dbId,
                        "icon",
                        event.target.value
                      )
                    }
                    placeholder="BookOpen, Users, Target, Clock, Brain, etc."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-600">
                  Title
                  <input
                    type="text"
                    value={service.title}
                    onChange={(event) =>
                      handleFieldChange(
                        service.dbId,
                        "title",
                        event.target.value
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-600">
                  Description
                  <textarea
                    value={service.description}
                    onChange={(event) =>
                      handleFieldChange(
                        service.dbId,
                        "description",
                        event.target.value
                      )
                    }
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-600">
                  Features (comma separated)
                  <textarea
                    value={service.featuresText}
                    onChange={(event) =>
                      handleFieldChange(
                        service.dbId,
                        "featuresText",
                        event.target.value
                      )
                    }
                    rows={2}
                    placeholder="Feature 1, Feature 2, Feature 3"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-slate-600">
                    Sort Order
                    <input
                      type="number"
                      step="1"
                      value={service.sortOrder}
                      onChange={(event) =>
                        handleFieldChange(
                          service.dbId,
                          "sortOrder",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mt-6">
                    <input
                      type="checkbox"
                      checked={service.isActive}
                      onChange={(event) =>
                        handleToggleActive(
                          service.dbId,
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Visible on landing page
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={() => handleReset(service.dbId)}
                  disabled={!hasChanges(service) || savingServiceId === service.dbId}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(service.dbId)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                  <button
                    onClick={() => handleSave(service)}
                    disabled={
                      !hasChanges(service) || savingServiceId === service.dbId
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <Save size={16} />
                    {savingServiceId === service.dbId ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {service.updatedAt && (
                <p className="mt-4 text-xs text-slate-400">
                  Last updated:{" "}
                  {new Date(service.updatedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


