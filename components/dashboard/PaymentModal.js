"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Wallet } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function PaymentModal({ isOpen, onClose, plan, userId }) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payMongoPaymentData, setPayMongoPaymentData] = useState(null);

  if (!isOpen) return null;

  const handleStripePayment = async () => {
    if (!plan || !userId) {
      setError("Missing plan or user information");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create checkout session
      const response = await fetch("/api/payments/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: plan.id,
          credits: plan.credits,
          price: plan.price,
          userId: userId,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server error: Received HTML instead of JSON. Please check your server logs and environment variables.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      console.error("Stripe payment error:", err);
      setError(err.message || "Failed to initiate Stripe payment");
      setLoading(false);
    }
  };

  const handlePayMongoPayment = async () => {
    if (!plan || !userId) {
      setError("Missing plan or user information");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create payment intent
      const response = await fetch("/api/payments/paymongo/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: plan.id,
          credits: plan.credits,
          price: plan.price,
          userId: userId,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server error: Received HTML instead of JSON. Please check your server logs.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment");
      }

      // Store payment data and initialize form after component re-renders
      setPayMongoPaymentData(data);
      setLoading(false);
    } catch (err) {
      console.error("PayMongo payment error:", err);
      setError(err.message || "Failed to initiate PayMongo payment");
      setLoading(false);
    }
  };

  const initializePayMongoPayment = async (paymentData) => {
    return new Promise((resolve, reject) => {
      // Load PayMongo JS if not already loaded
      if (window.Paymongo) {
        setupPayMongoForm(paymentData);
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.paymongo.com/v1";
      script.async = true;
      
      script.onload = () => {
        setupPayMongoForm(paymentData);
        resolve();
      };

      script.onerror = () => {
        setError("Failed to load PayMongo payment form");
        setLoading(false);
        reject(new Error("Failed to load PayMongo SDK"));
      };

      document.head.appendChild(script);
    });
  };

  const setupPayMongoForm = (paymentData) => {
    // Wait for DOM to be ready and card container to exist
    const mountCard = () => {
      const cardContainer = document.getElementById("paymongo-card-element");
      if (!cardContainer) {
        // Retry after a short delay if container not found
        setTimeout(mountCard, 100);
        return;
      }

      try {
        if (!window.Paymongo) {
          throw new Error("PayMongo SDK not loaded");
        }

        const paymongo = window.Paymongo(process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY);
        
        // Clear any existing content
        cardContainer.innerHTML = "";

        // Create card element
        const elements = paymongo.elements();
        const cardElement = elements.create("card", {
          style: {
            base: {
              fontSize: "16px",
              color: "#32325d",
              fontFamily: "system-ui, -apple-system, sans-serif",
              "::placeholder": {
                color: "#aab7c4",
              },
            },
          },
        });

        cardElement.mount("#paymongo-card-element");

        // Handle form submission
        const form = document.getElementById("paymongo-payment-form");
        if (form) {
          // Remove existing event listeners by replacing the form
          const newForm = form.cloneNode(true);
          form.parentNode.replaceChild(newForm, form);

          newForm.onsubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            setError("");

            try {
              // Create payment method
              const { paymentMethod: pm, error: pmError } = await paymongo.methods.create(cardElement);
              
              if (pmError) {
                throw new Error(pmError.message || "Failed to create payment method");
              }

              // Confirm payment
              const confirmResponse = await fetch("/api/payments/paymongo/confirm-payment", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  paymentIntentId: paymentData.paymentIntentId,
                  paymentMethodId: pm.id,
                }),
              });

              const confirmData = await confirmResponse.json();

              if (!confirmResponse.ok) {
                throw new Error(confirmData.error || "Payment confirmation failed");
              }

              // Handle 3DS if needed
              if (confirmData.nextAction && confirmData.nextAction.type === "redirect") {
                // Redirect to 3DS authentication
                window.location.href = confirmData.nextAction.redirect.url;
              } else if (confirmData.status === "succeeded") {
                // Payment succeeded, redirect to success page
                window.location.href = paymentData.successUrl;
              } else {
                // Check payment status again after a short delay
                setTimeout(() => {
                  window.location.href = paymentData.successUrl;
                }, 1000);
              }
            } catch (err) {
              console.error("PayMongo payment error:", err);
              setError(err.message || "Payment failed. Please try again.");
              setLoading(false);
            }
          };
        }
      } catch (err) {
        console.error("PayMongo setup error:", err);
        setError("Failed to initialize payment form");
        setLoading(false);
      }
    };

    mountCard();
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    setError("");
    setPayMongoPaymentData(null);
  };

  // Initialize PayMongo form when payment method is selected and payment data is available
  useEffect(() => {
    if (selectedPaymentMethod === "paymongo" && payMongoPaymentData) {
      initializePayMongoPayment(payMongoPaymentData);
    }
  }, [selectedPaymentMethod, payMongoPaymentData]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            Choose Payment Method
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Plan Summary */}
        {plan && (
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-2">Order Summary</h3>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">
                {plan.credits} Credits
              </span>
              <span className="text-xl font-bold text-slate-900">
                ${plan.price}
              </span>
            </div>
          </div>
        )}

        {/* Payment Method Selection */}
        <div className="p-6 space-y-4">
          {!selectedPaymentMethod ? (
            <>
              <p className="text-slate-600 mb-4">
                Select your preferred payment method:
              </p>
              
              <button
                onClick={() => handlePaymentMethodSelect("stripe")}
                className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group"
                disabled={loading}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="text-slate-600 group-hover:text-blue-600" size={24} />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Stripe</p>
                    <p className="text-sm text-slate-500">Pay with card via Stripe</p>
                  </div>
                </div>
                <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </div>
              </button>

              <button
                onClick={() => handlePaymentMethodSelect("paymongo")}
                className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group"
                disabled={loading}
              >
                <div className="flex items-center gap-3">
                  <Wallet className="text-slate-600 group-hover:text-blue-600" size={24} />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">PayMongo</p>
                    <p className="text-sm text-slate-500">Pay with card via PayMongo</p>
                  </div>
                </div>
                <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </div>
              </button>
            </>
          ) : selectedPaymentMethod === "stripe" ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedPaymentMethod(null)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                disabled={loading}
              >
                ← Back to payment methods
              </button>
              <button
                onClick={handleStripePayment}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  "Continue to Stripe Checkout"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedPaymentMethod(null);
                  setPayMongoPaymentData(null);
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                disabled={loading}
              >
                ← Back to payment methods
              </button>
              
              {!payMongoPaymentData ? (
                <button
                  onClick={handlePayMongoPayment}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Initializing...
                    </>
                  ) : (
                    "Initialize Payment"
                  )}
                </button>
              ) : (
                <form id="paymongo-payment-form" className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Card Information
                    </label>
                    <div id="paymongo-card-element" className="p-3 border border-slate-300 rounded-lg min-h-[50px]">
                      {/* PayMongo card element will be mounted here */}
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      "Pay with PayMongo"
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

