"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Zap } from "lucide-react";
import PaymentModal from "./PaymentModal";

const usPlans = [
  { 
    id: "starter", 
    name: "Starter", 
    credits: 2, 
    price: 30, 
    hours: 1,
    pricePerHour: 30,
    description: "Trial or short-term"
  },
  { 
    id: "standard", 
    name: "Standard", 
    credits: 6, 
    price: 75, 
    hours: 3,
    pricePerHour: 25,
    description: "Ongoing support"
  },
  { 
    id: "premium", 
    name: "Premium", 
    credits: 12, 
    price: 132, 
    hours: 6,
    pricePerHour: 22,
    description: "Long-term package"
  },
  { 
    id: "family", 
    name: "Family Pack", 
    credits: 20, 
    price: 180, 
    hours: 10,
    pricePerHour: 18,
    description: "With siblings"
  },
  { 
    id: "elite", 
    name: "Elite Pack", 
    credits: 30, 
    price: 450, 
    hours: 15,
    pricePerHour: 15,
    description: "Extended family pack"
  }
];

const phPlans = [
  { 
    id: "starter-ph", 
    name: "Starter Pack", 
    credits: 5, 
    price: 750, 
    hours: 2.5,
    pricePerCredit: 150,
    description: "Trial / casual learners"
  },
  { 
    id: "standard-ph", 
    name: "Standard Pack", 
    credits: 10, 
    price: 1400, 
    hours: 5,
    pricePerCredit: 140,
    description: "Regular learners"
  },
  { 
    id: "premium-ph", 
    name: "Premium Pack", 
    credits: 20, 
    price: 2700, 
    hours: 10,
    pricePerCredit: 135,
    description: "Intensive learners / exam prep"
  },
  { 
    id: "family-ph", 
    name: "Family Pack", 
    credits: 40, 
    price: 5000, 
    hours: 20,
    pricePerCredit: 125,
    description: "Multiple siblings / high-usage"
  }
];

export default function Credits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [creditPlans, setCreditPlans] = useState(usPlans);
  const [userCountry, setUserCountry] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const isLoading = loadingCredits || loadingPlans;

  // Fetch user credits
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) {
        setLoadingCredits(false);
        return;
      }

      setLoadingCredits(true);
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
        setLoadingCredits(false);
      }
    };

    fetchCredits();
  }, [user]);

  // Detect user's country
  useEffect(() => {
    const detectUserCountry = async () => {
      try {
        // First try to get country from geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                );
                const data = await response.json();
                const country = data.address?.country || 'US';
                setUserCountry(country);
                setCreditPlans(country === 'Philippines' || country === 'PH' ? phPlans : usPlans);
              } catch (error) {
                console.error('Error getting location:', error);
                setUserCountry('US');
                setCreditPlans(usPlans);
              }
            },
            (error) => {
              console.error('Geolocation error:', error);
              setUserCountry('US');
              setCreditPlans(usPlans);
            },
            { timeout: 5000 }
          );
        } else {
          // Fallback to IP-based country detection if geolocation is not available
          try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            const country = data.country_name || 'US';
            setUserCountry(country);
            setCreditPlans(country === 'Philippines' || country === 'PH' ? phPlans : usPlans);
          } catch (error) {
            console.error('Error getting country from IP:', error);
            setUserCountry('US');
            setCreditPlans(usPlans);
          }
        }
      } catch (error) {
        console.error('Error detecting country:', error);
        setUserCountry('US');
        setCreditPlans(usPlans);
      }
    };

    detectUserCountry();
  }, []);

  // Fetch credit plans from database (kept for backward compatibility)
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const { data, error } = await supabase
          .from("credit_plans")
          .select(
            "id, slug, name, credits, price_usd, savings_percent, is_active, sort_order"
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("credits", { ascending: true });

        if (error) {
          console.error("Error fetching credit plans:", error);
          return;
        }

        if (data && data.length > 0) {
          const normalizedPlans = data.map((plan) => {
            const parsedPrice = Number.parseFloat(plan.price_usd);
            const normalizedPrice = Number.isFinite(parsedPrice)
              ? parsedPrice
              : 0;

            return {
              id: plan.slug || plan.id,
              slug: plan.slug || plan.id,
              name: plan.name || plan.slug || "Credit Plan",
              credits: plan.credits,
              price: normalizedPrice,
              savings: plan.savings_percent || 0,
              sortOrder: plan.sort_order,
            };
          });
          setCreditPlans(normalizedPlans);
        }
      } catch (planError) {
        console.error("Unexpected error fetching plans:", planError);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

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
        You currently have <span className="font-semibold">{credits} credits</span>
        {userCountry && (
          <span className="ml-2 text-sm text-gray-500">
            (Pricing for {userCountry === 'Philippines' || userCountry === 'PH' ? 'Philippines' : 'International'})
          </span>
        )}
      </p>
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
        <div key={plan.id} className="p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white">
          {plan.savings > 0 && (
            <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded mb-3 inline-block">
              Save {plan.savings}%
            </div>
          )}
          <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
          <p className="text-3xl font-bold text-primary mb-2">
            {userCountry === 'Philippines' || userCountry === 'PH' ? (
              `₱${plan.price.toLocaleString()}`
            ) : (
              `$${plan.price}`
            )}
          </p>
          <p className="text-gray-600 mb-1">{plan.credits} credits</p>
          <p className="text-gray-600 mb-1">{plan.hours} hours</p>
          {plan.pricePerHour && (
            <p className="text-sm text-gray-500">${plan.pricePerHour}/hour</p>
          )}
          {plan.pricePerCredit && (
            <p className="text-sm text-gray-500">₱{plan.pricePerCredit} per credit</p>
          )}
          <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
          <button
            onClick={() => handlePlanSelect(plan.id)}
            className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-lg shadow transition-colors"
          >
            Buy Credits
          </button>
        </div>
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
