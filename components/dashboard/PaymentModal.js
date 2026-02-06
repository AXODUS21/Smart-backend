"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Wallet } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

export default function PaymentModal({ isOpen, onClose, plan, userId }) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payMongoPaymentData, setPayMongoPaymentData] = useState(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvc, setCvc] = useState("");

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
      // Create payment intent
      const response = await fetch("/api/payments/paymongo/create-payment", {
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

  // Handle PayMongo checkout using our own API for payment_methods
  const handlePayMongoSubmit = async (e) => {
    e.preventDefault();
    if (!payMongoPaymentData) return;

    try {
      setLoading(true);
      setError("");

      // Basic card validation (very light)
      if (!cardNumber || !expMonth || !expYear || !cvc) {
        throw new Error("Please complete all card fields.");
      }

      // 1. Create payment method on our backend (uses PayMongo secret key)
      const pmRes = await fetch(
        "/api/payments/paymongo/create-payment-method",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardNumber: cardNumber.replace(/\s+/g, ""),
            expMonth,
            expYear,
            cvc,
            billing: {},
          }),
        }
      );

      const pmJson = await pmRes.json();
      if (!pmRes.ok) {
        throw new Error(pmJson.error || "Failed to create payment method.");
      }

      const paymentMethodId = pmJson.paymentMethodId;
      if (!paymentMethodId) {
        throw new Error("No payment method ID returned from server.");
      }

      // 2. Confirm payment intent using existing API
      const confirmResponse = await fetch(
        "/api/payments/paymongo/confirm-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentIntentId: payMongoPaymentData.paymentIntentId,
            paymentMethodId,
          }),
        }
      );

      const confirmData = await confirmResponse.json();
      if (!confirmResponse.ok) {
        throw new Error(
          confirmData.error || "Payment confirmation failed."
        );
      }

      if (
        confirmData.nextAction &&
        confirmData.nextAction.type === "redirect"
      ) {
        window.location.href = confirmData.nextAction.redirect.url;
      } else if (confirmData.status === "succeeded") {
        window.location.href = payMongoPaymentData.successUrl;
      } else {
        setTimeout(() => {
          window.location.href = payMongoPaymentData.successUrl;
        }, 1000);
      }
    } catch (err) {
      console.error("PayMongo payment error:", err);
      setError(err.message || "Payment failed. Please try again.");
      setLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    setError("");
    setPayMongoPaymentData(null);
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
                <form
                  id="paymongo-payment-form"
                  className="space-y-4"
                  onSubmit={handlePayMongoSubmit}
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg"
                      placeholder="4111 1111 1111 1111"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Expiry (MM / YYYY)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          value={expMonth}
                          onChange={(e) => setExpMonth(e.target.value)}
                          className="w-full p-3 border border-slate-300 rounded-lg"
                          placeholder="MM"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={expYear}
                          onChange={(e) => setExpYear(e.target.value)}
                          className="w-full p-3 border border-slate-300 rounded-lg"
                          placeholder="YYYY"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        CVC
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg"
                        placeholder="123"
                      />
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
