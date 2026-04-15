"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PaymentModal({ isOpen, onClose, plan, userId, userType = "student" }) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [notice, setNotice] = useState("");
  const [manualRequestSubmitted, setManualRequestSubmitted] = useState(false);


  const planId = plan?.id || plan?.slug;

  if (!isOpen) return null;

  const messengerUrl = "https://www.facebook.com/smart.brain.5059";

  useEffect(() => {
    if (!isOpen) return;
    if (!userId || !planId) {
      setReferenceCode("");
      return;
    }
    const shortUser = String(userId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
    const shortPlan = String(planId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
    setReferenceCode(`SB-${shortUser}-${shortPlan}-${Date.now().toString(36)}`.toUpperCase());
  }, [isOpen, userId, planId]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPaymentMethod(null);
      setManualRequestSubmitted(false);
      setNotice("");
      setError("");
    }
  }, [isOpen]);

  const handleStripePayment = async () => {
    if (!planId || !userId) {
      setError("Missing plan or user information");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

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

  const handleSubmitManualTopupRequest = async () => {
    if (userType !== "student") return;
    if (!planId || !userId || !referenceCode) {
      setError("Missing plan, user, or reference information");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/payments/manual-topup/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          userId,
          planId,
          referenceCode,
        }),
      });

      const contentType = response.headers.get("content-type");
      const data =
        contentType && contentType.includes("application/json")
          ? await response.json()
          : { error: await response.text() };

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      if (data?.request?.reference_code) {
        setReferenceCode(data.request.reference_code);
      }
      setManualRequestSubmitted(true);
      setNotice(
        "Request submitted. Now pay via the GCash QR below, then send your payment proof in Messenger with your reference code."
      );
    } catch (err) {
      setError(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedPaymentMethod(method);
    setError("");
    setNotice("");
    setManualRequestSubmitted(false);
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

              {userType === "student" && (
                <button
                  onClick={() => handlePaymentMethodSelect("gcash")}
                  className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group"
                  disabled={loading}
                >
                  <div className="flex items-center gap-3">
                    <Wallet
                      className="text-slate-600 group-hover:text-blue-600"
                      size={24}
                    />
                    <div className="text-left">
                      <p className="font-semibold text-slate-900">GCash QR</p>
                      <p className="text-sm text-slate-500">
                        Pay via QR, then send proof on Messenger
                      </p>
                    </div>
                  </div>
                  <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </div>
                </button>
              )}
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

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Pay using GCash QR</p>
                {!manualRequestSubmitted ? (
                  <p className="text-sm text-slate-600 mt-1">
                    Step 1: Submit your top-up request first. After that, we will show your QR payment instructions and reference code.
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 mt-1">
                    Step 2: Scan the QR code, pay the exact amount, then send your receipt/proof on Facebook Messenger.
                  </p>
                )}

                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">Amount</span>
                    <span className="font-semibold text-slate-900">
                      {plan?.region === "PH" ? "₱" : "$"}
                      {Number(plan?.price || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">Credits</span>
                    <span className="font-semibold text-slate-900">
                      {plan?.credits || ""} credits
                    </span>
                  </div>

                  {!manualRequestSubmitted ? (
                    <button
                      type="button"
                      onClick={handleSubmitManualTopupRequest}
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 text-white py-2.5 font-semibold hover:bg-slate-800 transition-colors disabled:bg-slate-400"
                    >
                      {loading ? "Submitting..." : "Submit top-up request"}
                    </button>
                  ) : (
                    <>
                      <div className="mt-2 flex items-center justify-center">
                        <img
                          src="/gcashqr.jpg"
                          alt="GCash QR"
                          className="w-56 h-auto rounded-md border border-slate-200 bg-white"
                        />
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-slate-600">Send this reference code with your proof:</p>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 px-2 py-1 rounded bg-white border border-slate-200 text-slate-900 text-xs break-all">
                            {referenceCode || "—"}
                          </code>
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:bg-slate-400"
                            disabled={!referenceCode}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(referenceCode);
                              } catch {
                                setError("Could not copy reference code. Please copy it manually.");
                              }
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <a
                        href={messengerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 text-white py-2.5 font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Open Facebook Messenger
                      </a>
                    </>
                  )}

                  <p className="text-xs text-slate-500 mt-2">
                    After we verify your payment, we will add the credits manually.
                  </p>
                </div>
              </div>
            </div>
          )}

          {notice && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg text-sm">
              {notice}
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
