"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Wallet } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

// Initialize Stripe - only in browser environment
let stripePromise = null;
if (typeof window !== "undefined") {
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (stripeKey) {
    stripePromise = loadStripe(stripeKey);
  }
}

export default function PaymentModal({ isOpen, onClose, plan, userId }) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payMongoPaymentData, setPayMongoPaymentData] = useState(null);

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

        // Initialize PayMongo with the client key from payment intent (required for Elements)
        // The clientKey is used to link the payment method to the payment intent
        const clientKey = paymentData.clientKey;
        if (!clientKey) {
          throw new Error("Payment intent client key is missing");
        }

        console.log(
          "Initializing PayMongo with client key:",
          clientKey.substring(0, 10) + "..."
        );
        const paymongo = window.Paymongo(clientKey); // Use clientKey for Elements (not publicKey)

        // Check if paymongo object is valid
        if (!paymongo) {
          throw new Error("Failed to initialize PayMongo SDK");
        }

        console.log("PayMongo object:", paymongo);
        console.log("PayMongo methods:", Object.keys(paymongo));

        // Clear any existing content
        cardContainer.innerHTML = "";

        // Create card element using PayMongo Elements
        if (!paymongo.elements) {
          throw new Error("PayMongo elements not available");
        }

        const elements = paymongo.elements();
        if (!elements || !elements.create) {
          throw new Error("PayMongo elements.create not available");
        }

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

        if (!cardElement || !cardElement.mount) {
          throw new Error("Failed to create card element");
        }

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
              console.log("Creating payment method...");

              // Create payment method using PayMongo Elements
              // Based on the error log, paymongo.createPaymentMethod exists directly on the paymongo object
              let paymentMethodId;

              try {
                console.log("PayMongo object methods:", Object.keys(paymongo));

                // PayMongo SDK structure: createPaymentMethod is directly on paymongo object
                // It requires a payload with type property
                if (typeof paymongo.createPaymentMethod === "function") {
                  console.log("Using paymongo.createPaymentMethod...");

                  // PayMongo createPaymentMethod requires: { type: 'card', ... }
                  // The cardElement from PayMongo Elements needs to be used to get payment method data
                  let result;

                  // PayMongo Elements: Create payment method from card element
                  // The cardElement collects card data, we need to create a payment method from it

                  // Method 1: Try cardElement.createPaymentMethod (if available)
                  if (typeof cardElement.createPaymentMethod === "function") {
                    console.log("Using cardElement.createPaymentMethod...");
                    result = await cardElement.createPaymentMethod({
                      type: "card",
                    });
                  }
                  // Method 2: Use paymongo.createPaymentMethod with the cardElement
                  // PayMongo Elements: cardElement is passed as the source
                  else {
                    console.log(
                      "Using paymongo.createPaymentMethod with cardElement..."
                    );
                    // PayMongo expects: { type: 'card', billing: cardElement }
                    // The cardElement from PayMongo Elements contains the card data
                    result = await paymongo.createPaymentMethod({
                      type: "card",
                      billing: cardElement,
                    });
                  }

                  console.log("createPaymentMethod result:", result);

                  // Handle different response structures
                  if (result.error) {
                    throw new Error(
                      result.error.message || "Failed to create payment method"
                    );
                  }

                  // Extract payment method ID from result
                  if (result.paymentMethod && result.paymentMethod.id) {
                    paymentMethodId = result.paymentMethod.id;
                  } else if (result.id) {
                    paymentMethodId = result.id;
                  } else if (result.data && result.data.id) {
                    paymentMethodId = result.data.id;
                  } else {
                    console.error("Unexpected result structure:", result);
                    throw new Error(
                      "Invalid payment method response structure"
                    );
                  }
                } else {
                  throw new Error(
                    "paymongo.createPaymentMethod is not available"
                  );
                }

                if (!paymentMethodId) {
                  throw new Error(
                    "Could not extract payment method ID from response"
                  );
                }

                console.log("Payment method ID created:", paymentMethodId);
              } catch (pmError) {
                console.error("Payment method creation error:", pmError);
                console.error("Error details:", {
                  message: pmError.message,
                  stack: pmError.stack,
                  paymongoMethods: Object.keys(paymongo),
                });
                throw new Error(
                  `Payment method creation failed: ${pmError.message}`
                );
              }

              console.log("Payment method ID:", paymentMethodId);

              // Confirm payment
              const confirmResponse = await fetch(
                "/api/payments/paymongo/confirm-payment",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    paymentIntentId: paymentData.paymentIntentId,
                    paymentMethodId: paymentMethodId,
                  }),
                }
              );

              // Check if response is JSON
              const contentType = confirmResponse.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                const text = await confirmResponse.text();
                console.error("Non-JSON confirm response:", text);
                throw new Error(
                  "Server error: Received invalid response from payment confirmation."
                );
              }

              const confirmData = await confirmResponse.json();
              console.log("Confirm payment response:", confirmData);

              if (!confirmResponse.ok) {
                throw new Error(
                  confirmData.error || "Payment confirmation failed"
                );
              }

              // Handle 3DS if needed
              if (
                confirmData.nextAction &&
                confirmData.nextAction.type === "redirect"
              ) {
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
              console.error("Error details:", {
                message: err.message,
                stack: err.stack,
                paymongo: paymongo,
                methods: paymongo.methods,
              });
              setError(err.message || "Payment failed. Please try again.");
              setLoading(false);
            }
          };
        }
      } catch (err) {
        console.error("PayMongo setup error:", err);
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
          windowPaymongo: window.Paymongo,
        });
        setError(`Failed to initialize payment form: ${err.message}`);
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
                ${Number(plan.price).toFixed(2)}
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
                <form id="paymongo-payment-form" className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Card Information
                    </label>
                    <div
                      id="paymongo-card-element"
                      className="p-3 border border-slate-300 rounded-lg min-h-[50px]"
                    >
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
