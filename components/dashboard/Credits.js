"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Zap } from "lucide-react";

export default function Credits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [success, setSuccess] = useState("");

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

  // Handle credit purchase
  const handleBuyCredits = async () => {
    if (!user || !selectedPlan) return;

    const plan = creditPlans.find((p) => p.id === selectedPlan);
    if (!plan) return;

    setPurchasing(true);
    setSuccess("");

    try {
      // Get current credits
      const { data: currentData, error: fetchError } = await supabase
        .from("Students")
        .select("credits")
        .eq("user_id", user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentCredits = currentData?.credits || 0;
      const newCredits = currentCredits + plan.credits;

      // Update credits in database
      const { error: updateError } = await supabase
        .from("Students")
        .update({ credits: newCredits })
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setCredits(newCredits);
      setSuccess(
        `Successfully purchased ${plan.credits} credit${
          plan.credits > 1 ? "s" : ""
        }!`
      );
      setSelectedPlan(null);

      // Auto-dismiss success message
      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      console.error("Error purchasing credits:", error);
      alert("Error purchasing credits. Please try again.");
    } finally {
      setPurchasing(false);
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {creditPlans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
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

      {selectedPlan && (
        <div className="space-y-3">
          <button
            onClick={handleBuyCredits}
            disabled={purchasing}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {purchasing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              "Purchase Credits"
            )}
          </button>

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
