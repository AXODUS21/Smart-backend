"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Zap } from "lucide-react";
import PaymentModal from "./PaymentModal";

export default function Credits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const creditPlans = [
    { id: "starter", credits: 10, price: 29.99, savings: 0 },
    { id: "popular", credits: 30, price: 79.99, savings: 10 },
    { id: "pro", credits: 60, price: 149.99, savings: 20 },
    { id: "elite", credits: 100, price: 229.99, savings: 30 },
  ];

  // Fetch user credits
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("Students")
          .select("credits")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching credits:", error);
        } else {
          setCredits(data?.credits || 0);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [user]);

  // Handle URL parameters for payment success/error
  useEffect(() => {
    if (typeof window !== "undefined") {
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
            .select("credits")
            .eq("user_id", user.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setCredits(data.credits || 0);
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
          errorText = `Payment not completed. Status: ${statusParam || "unknown"}`;
        } else if (errorParam === "fetch_error") {
          errorText = "Error fetching your account information. Please contact support.";
        } else if (errorParam === "update_error") {
          errorText = "Error updating credits. Please contact support with your payment receipt.";
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

  if (loading) {
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
      {/* Low credit warning notification */}
      {credits < 4 && (
        <div className="flex items-center gap-4 bg-orange-100 border-l-4 border-orange-500 text-orange-800 px-4 py-3 rounded mb-2">
          <Zap className="text-orange-500" size={28} />
          <div className="flex-1">
            <div className="font-bold">Low Credits Warning</div>
            <div className="text-sm">
              Your balance is getting low. Please consider buying more credits!
            </div>
          </div>
          <button
            onClick={() => {
              // Scroll to credit plans section or just focus. (No-op here, can be refined if you add refs)
              const plans = document.querySelector('[data-credit-plans]');
              if (plans) {
                plans.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              setSelectedPlan(null); // Force plans to reset if needed
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-lg shadow transition-colors"
          >
            Buy Credits
          </button>
        </div>
      )}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Buy Credits
        </h2>
        <p className="text-slate-500">1 credit = 30 minutes of tutoring</p>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <Zap className="text-orange-500" size={24} />
          <div>
            <p className="font-semibold text-slate-900">Current Balance</p>
            <p className="text-2xl font-bold text-slate-900">
              {credits} credits
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-credit-plans>
        {creditPlans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => handlePlanSelect(plan.id)}
            className={`p-6 rounded-lg border-2 transition-all text-left ${
              selectedPlan === plan.id
                ? "border-blue-600 bg-blue-50"
                : "border-slate-200 hover:border-blue-300"
            }`}
          >
            {plan.savings > 0 && (
              <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded mb-3 inline-block">
                Save {plan.savings}%
              </div>
            )}
            <p className="text-3xl font-bold text-slate-900 mb-1">
              {plan.credits}
            </p>
            <p className="text-sm text-slate-600 mb-4">credits</p>
            <p className="text-2xl font-bold text-slate-900">${plan.price}</p>
            <p className="text-xs text-slate-500 mt-2">
              ${(plan.price / plan.credits).toFixed(2)}/credit
            </p>
          </button>
        ))}
      </div>

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

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={handleCloseModal}
          plan={creditPlans.find((p) => p.id === selectedPlan)}
          userId={user?.id}
        />
      )}
    </div>
  );
}
