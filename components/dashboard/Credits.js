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
  price: plan.region === 'PH' ? plan.price_php : plan.price_usd,
  hours: plan.hours,
  pricePerHour: plan.price_per_hour,
  pricePerCredit: plan.price_per_credit,
  description: plan.description,
  region: plan.region
});

export default function Credits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [userCountry, setUserCountry] = useState('US');
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [success, setSuccess] = useState("");

  // Fetch plans from the database
  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      setError('');
      
      const { data, error } = await supabase
        .from('credit_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setPlans(data.map(normalizePlan));
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to load pricing plans. Please try again later.');
    } finally {
      setLoadingPlans(false);
    }
  };

  // Detect user's country
  useEffect(() => {
    const detectCountry = async () => {
      try {
        // First try geolocation API
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&accept-language=en`
                );
                const data = await response.json();
                const countryCode = data?.address?.country_code?.toUpperCase();
                if (countryCode === 'PH') {
                  setUserCountry('PH');
                }
              } catch (err) {
                console.error('Error getting location from coordinates:', err);
                // Fallback to IP-based detection
                await detectCountryByIP();
              }
            },
            async () => {
              // If geolocation is denied, fallback to IP-based detection
              await detectCountryByIP();
            }
          );
        } else {
          // If geolocation is not available, use IP-based detection
          await detectCountryByIP();
        }
      } catch (err) {
        console.error('Error detecting country:', err);
        setUserCountry('US'); // Default to US on error
      }
    };

    const detectCountryByIP = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setUserCountry(data.country === 'PH' ? 'PH' : 'US');
      } catch (err) {
        console.error('Error detecting country by IP:', err);
        setUserCountry('US'); // Default to US on error
      }
    };

    detectCountry();
    fetchPlans();
  }, []);

  // Filter plans based on user's country
  const filteredPlans = plans.filter(plan => plan.region === userCountry);

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
          You currently have <span className="font-semibold">{credits} credits</span>
          {userCountry && (
            <span className="ml-2 text-sm text-gray-500">
              (Pricing for {userCountry === 'PH' ? 'Philippines' : 'International'})
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
      </div>


      {loadingPlans ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-6 animate-pulse">
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
          <p className="text-gray-500">No pricing plans available for your region.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => (
            <div key={plan.id} className="p-6 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white">
              {plan.savings > 0 && (
                <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded mb-3 inline-block">
                  Save {plan.savings}%
                </div>
              )}
              <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold">
                {plan.price.toLocaleString(undefined, {
                  style: 'currency',
                  currency: userCountry === 'PH' ? 'PHP' : 'USD',
                  maximumFractionDigits: 0,
                })}
                {userCountry === 'PH' && (
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    ({plan.pricePerCredit.toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'PHP',
                      maximumFractionDigits: 0,
                    })}/credit)
                  </span>
                )}
              </div>
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

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
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
