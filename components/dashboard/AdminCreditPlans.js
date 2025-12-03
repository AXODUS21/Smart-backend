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
  const priceUsdNumber = Number.parseFloat(plan.price_usd || 0);
  const pricePhpNumber = Number.parseFloat(plan.price_php || 0);
  const normalizedPriceUsd = Number.isFinite(priceUsdNumber)
    ? priceUsdNumber
    : 0;
  const normalizedPricePhp = Number.isFinite(pricePhpNumber)
    ? pricePhpNumber
    : 0;
  const isPhPlan = plan.region === "PH";

  const creditsValue =
    typeof plan.credits === "number" ? plan.credits.toString() : "0";
  const savingsValue =
    typeof plan.savings_percent === "number"
      ? plan.savings_percent.toString()
      : "0";
  const sortOrderValue =
    typeof plan.sort_order === "number" ? plan.sort_order.toString() : "0";
  const hoursValue =
    typeof plan.hours === "number" ? plan.hours.toString() : "0";
  const pricePerHourValue =
    typeof plan.price_per_hour === "number"
      ? plan.price_per_hour.toString()
      : "0";
  const pricePerCreditValue =
    typeof plan.price_per_credit === "number"
      ? plan.price_per_credit.toString()
      : "0";

  return {
    dbId: plan.id,
    slug: plan.slug,
    name: plan.name || "",
    region: plan.region || "US",
    credits: creditsValue,
    hours: hoursValue,
    price: isPhPlan
      ? normalizedPricePhp.toFixed(2)
      : normalizedPriceUsd.toFixed(2),
    priceUsd: normalizedPriceUsd.toFixed(2),
    pricePhp: normalizedPricePhp.toFixed(2),
    pricePerHour: pricePerHourValue,
    pricePerCredit: pricePerCreditValue,
    savings: savingsValue,
    sortOrder: sortOrderValue,
    isActive: plan.is_active ?? true,
    updatedAt: plan.updated_at,
    description: plan.description || "",
    original: {
      credits: creditsValue,
      hours: hoursValue,
      price: isPhPlan
        ? normalizedPricePhp.toFixed(2)
        : normalizedPriceUsd.toFixed(2),
      priceUsd: normalizedPriceUsd.toFixed(2),
      pricePhp: normalizedPricePhp.toFixed(2),
      pricePerHour: pricePerHourValue,
      pricePerCredit: pricePerCreditValue,
      savings: savingsValue,
      sortOrder: sortOrderValue,
      isActive: plan.is_active ?? true,
      description: plan.description || "",
      region: plan.region || "US",
    },
  };
};

export default function AdminCreditPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeRegion, setActiveRegion] = useState("US");
  const [dirty, setDirty] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError("");
      const { data, error: planError } = await supabase
        .from("credit_plans")
        .select(
          `id, slug, name, credits, hours, price_usd, price_php, price_per_hour, price_per_credit, 
          savings_percent, sort_order, is_active, updated_at, region, description`
        )
        .order("region", { ascending: true })
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
    setDirty(true);
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
    setDirty(true);
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
    plan.isActive !== plan.original.isActive ||
    plan.pricePerHour !== plan.original.pricePerHour ||
    plan.pricePerCredit !== plan.original.pricePerCredit;

  const handleReset = (planId) => {
    setDirty(false);
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

      const parsedHours = Number.parseFloat(plan.hours);
      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        setError("Hours must be a positive number.");
        return;
      }

      const parsedPriceUsd = Number.parseFloat(plan.priceUsd);
      const parsedPricePhp = Number.parseFloat(plan.pricePhp);

      if (!Number.isFinite(parsedPriceUsd) || parsedPriceUsd < 0) {
        setError("USD Price must be a positive number.");
        return;
      }

      if (!Number.isFinite(parsedPricePhp) || parsedPricePhp < 0) {
        setError("PHP Price must be a positive number.");
        return;
      }

      const parsedPricePerHour = plan.pricePerHour
        ? Number.parseFloat(plan.pricePerHour)
        : null;
      const parsedPricePerCredit = plan.pricePerCredit
        ? Number.parseFloat(plan.pricePerCredit)
        : null;

      if (
        plan.region === "US" &&
        parsedPricePerCredit !== null &&
        (!Number.isFinite(parsedPricePerCredit) || parsedPricePerCredit <= 0)
      ) {
        setError(
          "Price per credit must be a positive number if provided for US plans."
        );
        return;
      }

      if (
        plan.region === "PH" &&
        (!Number.isFinite(parsedPricePerCredit) || parsedPricePerCredit <= 0)
      ) {
        setError("Price per credit must be a positive number for PH plans.");
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

      if (!plan.slug) {
        setError(
          "Plan slug is required. Please refresh the page and try again."
        );
        return;
      }

      if (!plan.name) {
        setError(
          "Plan name is required. Please refresh the page and try again."
        );
        return;
      }

      setSavingPlanId(plan.dbId);

      const updates = {
        slug: plan.slug,
        name: plan.name,
        credits: parsedCredits,
        hours: parsedHours,
        price_usd: parsedPriceUsd,
        price_php: parsedPricePhp,
        price_per_hour: parsedPricePerHour,
        price_per_credit: parsedPricePerCredit,
        savings_percent: parsedSavings,
        sort_order: parsedSortOrder,
        is_active: plan.isActive,
        region: plan.region,
        description: plan.description || "",
      };

      if (Object.keys(updates).length === 0) {
        setSuccess("No changes to save for this plan.");
        setSavingPlanId(null);
        return;
      }

      const updatedAt = new Date().toISOString();
      updates.updated_at = updatedAt;

      const { error: updateError } = await supabase.from("credit_plans").upsert(
        {
          ...updates,
          id: plan.dbId || undefined, // For upsert to work with existing records
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
          returning: "minimal",
        }
      );

      if (updateError) {
        throw updateError;
      }

      setPlans((prev) =>
        prev.map((item) =>
          item.dbId === plan.dbId
            ? {
                ...item,
                credits: parsedCredits.toString(),
                hours: parsedHours.toString(),
                price:
                  plan.region === "PH"
                    ? parsedPricePhp.toFixed(2)
                    : parsedPriceUsd.toFixed(2),
                priceUsd: parsedPriceUsd.toFixed(2),
                pricePhp: parsedPricePhp.toFixed(2),
                pricePerHour: parsedPricePerHour?.toString() || "0",
                pricePerCredit: parsedPricePerCredit?.toString() || "0",
                savings: parsedSavings.toString(),
                sortOrder: parsedSortOrder.toString(),
                isActive: plan.isActive,
                updatedAt,
                original: {
                  ...item.original,
                  credits: parsedCredits.toString(),
                  hours: parsedHours.toString(),
                  price:
                    plan.region === "PH"
                      ? parsedPricePhp.toFixed(2)
                      : parsedPriceUsd.toFixed(2),
                  priceUsd: parsedPriceUsd.toFixed(2),
                  pricePhp: parsedPricePhp.toFixed(2),
                  pricePerHour: parsedPricePerHour?.toString() || "0",
                  pricePerCredit: parsedPricePerCredit?.toString() || "0",
                  savings: parsedSavings.toString(),
                  sortOrder: parsedSortOrder.toString(),
                  isActive: plan.isActive,
                },
              }
            : item
        )
      );
      setDirty(false);

      setSuccess("Credit plan updated successfully.");
    } catch (err) {
      console.error("Failed to update credit plan:", err);
      setError(
        err?.message || "Failed to update credit plan. Please try again."
      );
    } finally {
      setSavingPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Credit Plans</h1>
        <div className="flex items-center gap-4">
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setActiveRegion("US")}
              className={`px-4 py-2 text-sm font-medium ${
                activeRegion === "US"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              US Pricing
            </button>
            <button
              onClick={() => setActiveRegion("PH")}
              className={`px-4 py-2 text-sm font-medium ${
                activeRegion === "PH"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              PH Pricing
            </button>
          </div>
          <button
            onClick={fetchPlans}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
          {plans
            .filter((plan) => plan.region === activeRegion)
            .map((plan) => (
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
                        handleFieldChange(
                          plan.dbId,
                          "credits",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-600">
                    {plan.region === "US" ? "Price (USD)" : "Price (PHP)"}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        plan.region === "US" ? plan.priceUsd : plan.pricePhp
                      }
                      onChange={(event) =>
                        handleFieldChange(
                          plan.dbId,
                          plan.region === "US" ? "priceUsd" : "pricePhp",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-600">
                    Price per Credit ({plan.region === "US" ? "USD" : "PHP"})
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={plan.pricePerCredit}
                      onChange={(event) =>
                        handleFieldChange(
                          plan.dbId,
                          "pricePerCredit",
                          event.target.value
                        )
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
                          handleFieldChange(
                            plan.dbId,
                            "savings",
                            event.target.value
                          )
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
            ))}
        </div>
      )}
    </div>
  );
}
