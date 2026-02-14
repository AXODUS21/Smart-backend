"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Wallet } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

export default function PaymentModal({ isOpen, onClose, plan, userId }) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const planId = plan?.id || plan?.slug;

  if (!isOpen) return null;

  const handleStripePayment = async () => {
    if (!planId || !userId) {
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
          planId: planId,
          userId: userId,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(
          "Server error: Received HTML instead of JSON. Please check your server logs and environment variables."
        );
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
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      setError(
        err.message ||
          "Failed to initiate Stripe payment. Please check the console for details."
      );
      setLoading(false);
    }
  };

  const handlePayMongoPayment = async () => {
    if (!planId || !userId) {
      setError("Missing plan or user information");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create checkout session
      const response = await fetch("/api/payments/paymongo/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: planId,
          userId: userId,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(
          "Server error: Received HTML instead of JSON. Please check your server logs."
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.checkoutUrl) {
         window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }

    } catch (err) {
      console.error("PayMongo payment error:", err);
      setError(err.message || "Failed to initiate PayMongo payment");
      setLoading(false);
    }
  };



  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    setError("");
  };

  return (
    <div className="fixed inset-0 bg-gray-900/70 flex items-center justify-center z-50 p-4">
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
                {plan.name ? `${plan.name} · ` : ""}
                {plan.credits} Credits
              </span>
              <span className="text-xl font-bold text-slate-900">
                {plan.region === "PH" ? "₱" : "$"}
                {Number(plan.price).toFixed(2)}
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
                  <CreditCard
                    className="text-slate-600 group-hover:text-blue-600"
                    size={24}
                  />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Stripe</p>
                    <p className="text-sm text-slate-500">
                      Pay with card via Stripe
                    </p>
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
                  <Wallet
                    className="text-slate-600 group-hover:text-blue-600"
                    size={24}
                  />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">PayMongo</p>
                    <p className="text-sm text-slate-500">
                      Pay with card via PayMongo
                    </p>
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
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                disabled={loading}
              >
                ← Back to payment methods
              </button>

              <button
                onClick={handlePayMongoPayment}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Redirecting to PayMongo...
                  </>
                ) : (
                  "Continue to PayMongo Checkout"
                )}
              </button>
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
