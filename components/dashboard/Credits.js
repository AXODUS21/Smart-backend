"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Zap } from "lucide-react";
import PaymentModal from "./PaymentModal";

const normalizePlan = (plan) => ({
  id: plan.slug,
  name: plan.name,
  credits: plan.credits,
  price: plan.region === "PH" ? plan.price_php : plan.price_usd,
  hours: plan.hours,
  pricePerHour: plan.price_per_hour,
  pricePerCredit: plan.price_per_credit,
  description: plan.description,
  region: plan.region,
});

export default function Credits({ overrideStudentId }) {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [userCountry, setUserCountry] = useState("US");
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [success, setSuccess] = useState("");

  // Fetch plans from the database
  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      setError("");

      const { data, error } = await supabase
        .from("credit_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      setPlans(data.map(normalizePlan));
    } catch (err) {
      console.error("Error fetching plans:", err);
      setError("Failed to load pricing plans. Please try again later.");
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (!usePrincipalCredits) fetchPlans();
  }, [usePrincipalCredits]);

  // Filter plans based on user's country
  const filteredPlans = plans.filter((plan) => plan.region === userCountry);

  // When overrideStudentId: principal acting as student — use principal's shared credits only (no buying)
  const usePrincipalCredits = Boolean(overrideStudentId);

  // Fetch user credits and pricing region
  useEffect(() => {
    const fetchCreditsAndRegion = async () => {
      if (!user && !overrideStudentId) {
        setLoadingCredits(false);
        setUserCountry("US");
        return;
      }

      setLoadingCredits(true);
      try {
        let data = null;
        if (overrideStudentId) {
          // Principal's shared pool: fetch from Principals
          const res = await supabase
            .from("Principals")
            .select("credits, pricing_region")
            .eq("user_id", user.id)
            .single();
          data = res.data;
          if (res.error) throw res.error;
        } else {
          const res = await supabase
            .from("Students")
            .select("credits, pricing_region")
            .eq("user_id", user.id)
            .single();
          data = res.data;
          if (res.error) throw res.error;
        }

        setCredits(data?.credits || 0);
        setUserCountry(data?.pricing_region === "PH" ? "PH" : "US");
      } catch (error) {
        console.error("Error fetching credits/location:", error);
        setUserCountry("US");
      } finally {
        setLoadingCredits(false);
      }
    };

    fetchCreditsAndRegion();
  }, [user, overrideStudentId]);

  // Handle URL parameters for payment success/error (only for student; principal buys in Principal view)
  useEffect(() => {
    if (typeof window !== "undefined" && !usePrincipalCredits) {
      const params = new URLSearchParams(window.location.search);
      const successParam = params.get("success");
      const errorParam = params.get("error");
      const creditsParam = params.get("credits");

      if (successParam === "true") {
        setSuccess(
          `Successfully purchased ${creditsParam || ""} credit${
            creditsParam && parseInt(creditsParam) > 1 ? "s" : ""
          }!`
        );
        // Refresh credits
        if (user) {
          supabase
            .from("Students")
            .select("credits, pricing_region")
            .eq("user_id", user.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setCredits(data.credits || 0);
                setUserCountry(data.pricing_region === "PH" ? "PH" : "US");
              }
            });
        }
        // Auto-dismiss success message
        setTimeout(() => setSuccess(""), 5000);
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
      }

      if (errorParam) {
        // Get more specific error message if available
        const errorMessage = params.get("message");
        const statusParam = params.get("status");

        let errorText = "Payment failed. Please try again.";

        // Provide more specific error messages
        if (errorParam === "payment_not_completed") {
          errorText = `Payment not completed. Status: ${
            statusParam || "unknown"
          }`;
        } else if (errorParam === "fetch_error") {
          errorText =
            "Error fetching your account information. Please contact support.";
        } else if (errorParam === "update_error") {
          errorText =
            "Error updating credits. Please contact support with your payment receipt.";
        } else if (errorParam === "student_not_found") {
          errorText = "Student account not found. Please contact support.";
        } else if (errorParam === "missing_params") {
          errorText = "Missing payment information. Please try again.";
        } else if (errorParam === "processing_error") {
          errorText = errorMessage
            ? `Payment processing error: ${decodeURIComponent(errorMessage)}`
            : "Payment processing error. Please contact support.";
        } else if (errorMessage) {
          errorText = decodeURIComponent(errorMessage);
        }

        setError(errorText);
        setTimeout(() => setError(""), 10000); // Show error longer
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [user]);

  // Handle plan selection and open payment modal
  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    setShowPaymentModal(true);
    setError("");
    setSuccess("");
  };

  // Handle payment modal close
  const handleCloseModal = () => {
    setShowPaymentModal(false);
    // Optionally reset selected plan
    // setSelectedPlan(null);
  };

  const isLoading = loadingCredits || loadingPlans;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your Credits</h2>
        <p className="text-gray-600">
          You currently have{" "}
          <span className="font-semibold">{credits} credits</span>
          {userCountry && (
            <span className="ml-2 text-sm text-gray-500">
              (Pricing for{" "}
              {userCountry === "PH" ? "Philippines" : "International"})
            </span>
          )}
        </p>
      </div>

      <div className="bg-white rounded-lg p-6 shadow">
        <div className="flex items-center space-x-4">
          <Zap className="text-orange-500" size={24} />
          <div>
            <p className="font-semibold text-slate-900">Current Balance</p>
            <p className="text-2xl font-bold text-slate-900">
              {credits} credits
            </p>
          </div>
        </div>
        {usePrincipalCredits && (
          <p className="mt-4 text-sm text-slate-500">
            Credits are shared from your principal. To add credits, switch to Principal view and go to Add Credits.
          </p>
        )}
      </div>

      {usePrincipalCredits ? (
        <div className="text-center py-8 text-slate-500">
          <p>Only the principal can buy credits. Student profiles use the principal&apos;s shared balance.</p>
        </div>
      ) : loadingPlans ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-gray-200 rounded-lg p-6 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No pricing plans available for your region.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              {plan.savings > 0 && (
                <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded mb-3 inline-block">
                  Save {plan.savings}%
                </div>
              )}
              <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold">
                {plan.price.toLocaleString(undefined, {
                  style: "currency",
                  currency: userCountry === "PH" ? "PHP" : "USD",
                  maximumFractionDigits: 0,
                })}
                {userCountry === "PH" && (
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    (
                    {plan.pricePerCredit.toLocaleString(undefined, {
                      style: "currency",
                      currency: "PHP",
                      maximumFractionDigits: 0,
                    })}
                    /credit)
                  </span>
                )}
              </div>
              <p className="text-gray-600 mb-1">{plan.credits} credits</p>
              <p className="text-gray-600 mb-1">{plan.hours} hours</p>
              {plan.pricePerHour && (
                <p className="text-sm text-gray-500">
                  ${plan.pricePerHour}/hour
                </p>
              )}
              {plan.pricePerCredit && (
                <p className="text-sm text-gray-500">
                  ₱{plan.pricePerCredit} per credit
                </p>
              )}
              <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
              <button
                onClick={() => handlePlanSelect(plan.id)}
                className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg shadow transition-colors"
              >
                Buy Credits
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Payment Modal — only students can buy; principal buys in Principal → Add Credits */}
      {!usePrincipalCredits && showPaymentModal && selectedPlan && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={handleCloseModal}
          plan={filteredPlans.find((p) => p.id === selectedPlan)}
          userId={user?.id}
        />
      )}
    </div>
  );
}
