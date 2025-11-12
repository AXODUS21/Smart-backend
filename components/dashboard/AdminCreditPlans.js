"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  RefreshCw,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const normalizePlan = (plan) => {
  const priceNumber = Number.parseFloat(plan.price_usd);
  const normalizedPrice = Number.isFinite(priceNumber) ? priceNumber : 0;

  const creditsValue =
    typeof plan.credits === "number" ? plan.credits.toString() : "0";
  const savingsValue =
    typeof plan.savings_percent === "number"
      ? plan.savings_percent.toString()
      : "0";
  const sortOrderValue =
    typeof plan.sort_order === "number" ? plan.sort_order.toString() : "0";

  return {
    dbId: plan.id,
    slug: plan.slug,
    name: plan.name || "",
    credits: creditsValue,
    price: normalizedPrice.toFixed(2),
    savings: savingsValue,
    sortOrder: sortOrderValue,
    isActive: plan.is_active ?? true,
    updatedAt: plan.updated_at,
    original: {
      credits: creditsValue,
      price: normalizedPrice.toFixed(2),
      savings: savingsValue,
      sortOrder: sortOrderValue,
      isActive: plan.is_active ?? true,
    },
  };
};

export default function AdminCreditPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError("");
      const { data, error: planError } = await supabase
        .from("credit_plans")
        .select(
          "id, slug, name, credits, price_usd, savings_percent, sort_order, is_active, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("credits", { ascending: true });

      if (planError) {
        throw planError;
      }

      setPlans((data || []).map(normalizePlan));
    } catch (err) {
      console.error("Error loading credit plans:", err);
      setError(
        err?.message || "Failed to load credit plans. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
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

  const handleFieldChange = (planId, field, value) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.dbId === planId
          ? {
              ...plan,
              [field]: value,
            }
          : plan
      )
    );
  };

  const handleToggleActive = (planId, value) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.dbId === planId
          ? {
              ...plan,
              isActive: value,
            }
          : plan
      )
    );
  };

  const hasChanges = (plan) =>
    plan.price !== plan.original.price ||
    plan.credits !== plan.original.credits ||
    plan.savings !== plan.original.savings ||
    plan.sortOrder !== plan.original.sortOrder ||
    plan.isActive !== plan.original.isActive;

  const handleReset = (planId) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.dbId === planId
          ? {
              ...plan,
              ...plan.original,
              isActive: plan.original.isActive,
            }
          : plan
      )
    );
  };

  const handleSave = async (plan) => {
    try {
      setError("");
      setSuccess("");

      const parsedCredits = Number.parseInt(plan.credits, 10);
      if (!Number.isInteger(parsedCredits) || parsedCredits <= 0) {
        setError("Credits must be a positive whole number.");
        return;
      }

      const parsedPrice = Number.parseFloat(plan.price);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        setError("Price must be a positive number.");
        return;
      }

      const parsedSavings = Number.parseInt(plan.savings, 10);
      if (!Number.isInteger(parsedSavings) || parsedSavings < 0) {
        setError("Savings must be zero or a positive whole number.");
        return;
      }

      let parsedSortOrder = Number.parseInt(plan.sortOrder, 10);
      if (!Number.isFinite(parsedSortOrder)) {
        parsedSortOrder = 0;
      }

      setSavingPlanId(plan.dbId);

      const updates = {};

      if (plan.price !== plan.original.price) {
        updates.price_usd = parsedPrice.toFixed(2);
      }
      if (plan.credits !== plan.original.credits) {
        updates.credits = parsedCredits;
      }
      if (plan.savings !== plan.original.savings) {
        updates.savings_percent = parsedSavings;
      }
      if (plan.sortOrder !== plan.original.sortOrder) {
        updates.sort_order = parsedSortOrder;
      }
      if (plan.isActive !== plan.original.isActive) {
        updates.is_active = plan.isActive;
      }

      if (Object.keys(updates).length === 0) {
        setSuccess("No changes to save for this plan.");
        setSavingPlanId(null);
        return;
      }

      const updatedAt = new Date().toISOString();
      updates.updated_at = updatedAt;

      const { error: updateError } = await supabase
        .from("credit_plans")
        .update(updates)
        .eq("id", plan.dbId);

      if (updateError) {
        throw updateError;
      }

      setPlans((prev) =>
        prev.map((item) =>
          item.dbId === plan.dbId
            ? {
                ...item,
                credits: parsedCredits.toString(),
                price: parsedPrice.toFixed(2),
                savings: parsedSavings.toString(),
                sortOrder: parsedSortOrder.toString(),
                isActive: plan.isActive,
                updatedAt,
                original: {
                  credits: parsedCredits.toString(),
                  price: parsedPrice.toFixed(2),
                  savings: parsedSavings.toString(),
                  sortOrder: parsedSortOrder.toString(),
                  isActive: plan.isActive,
                },
              }
            : item
        )
      );

      setSuccess("Credit plan updated successfully.");
    } catch (err) {
      console.error("Failed to update credit plan:", err);
      setError(err?.message || "Failed to update credit plan. Please try again.");
    } finally {
      setSavingPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Credit Plan Pricing
          </h2>
          <p className="text-slate-500">
            Adjust the credit pack pricing and availability for students.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPlans}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin text-slate-500" : "text-slate-500"}
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
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
          No credit plans found. Contact support if this is unexpected.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const dirty = hasChanges(plan);
            return (
              <div
                key={plan.dbId}
                className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      {plan.slug || "Plan"}
                    </p>
                    <h3 className="text-xl font-bold text-slate-900">
                      {plan.name || "Credit Plan"}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      plan.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {plan.isActive ? "Active" : "Hidden"}
                  </span>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-600">
                    Credits
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={plan.credits}
                      onChange={(event) =>
                        handleFieldChange(plan.dbId, "credits", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-600">
                    Price (USD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={plan.price}
                      onChange={(event) =>
                        handleFieldChange(plan.dbId, "price", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm font-medium text-slate-600">
                      Savings (%)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={plan.savings}
                        onChange={(event) =>
                          handleFieldChange(plan.dbId, "savings", event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-600">
                      Sort Order
                      <input
                        type="number"
                        step="1"
                        value={plan.sortOrder}
                        onChange={(event) =>
                          handleFieldChange(
                            plan.dbId,
                            "sortOrder",
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={plan.isActive}
                      onChange={(event) =>
                        handleToggleActive(plan.dbId, event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Visible to students
                  </label>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleReset(plan.dbId)}
                    disabled={!dirty || savingPlanId === plan.dbId}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw size={16} />
                    Reset
                  </button>
                  <button
                    onClick={() => handleSave(plan)}
                    disabled={!dirty || savingPlanId === plan.dbId}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <Save size={16} />
                    {savingPlanId === plan.dbId ? "Saving..." : "Save Changes"}
                  </button>
                </div>

                {plan.updatedAt && (
                  <p className="mt-4 text-xs text-slate-400">
                    Last updated:{" "}
                    {new Date(plan.updatedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


