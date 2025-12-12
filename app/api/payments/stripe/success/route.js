import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendCreditPurchaseEmail } from "@/lib/resendHelper";

// Test import on module load
console.log(
  "[STRIPE SUCCESS] Module loaded. sendCreditPurchaseEmail imported:",
  typeof sendCreditPurchaseEmail
);

// Initialize Supabase with service role key for admin operations
// Service role key bypasses RLS policies
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }

  if (!serviceRoleKey) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not found, using anon key (may have RLS restrictions)"
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function GET(request) {
  console.log("[STRIPE SUCCESS] GET handler called");
  try {
    // Initialize Stripe (check at runtime)
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY is not configured in success handler");
      const url = new URL(request.url);
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=config_error`
      );
    }
    const stripe = new Stripe(stripeSecretKey);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const planId = searchParams.get("planId");
    const credits = parseInt(searchParams.get("credits"));
    const userId = searchParams.get("userId");

    console.log("Stripe success handler called:", {
      sessionId,
      planId,
      credits,
      userId,
    });

    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;

    if (!sessionId) {
      console.error("Missing session_id in success handler");
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=missing_session`
      );
    }

    if (!userId || !credits) {
      console.error("Missing userId or credits:", { userId, credits });
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=missing_params`
      );
    }

    // Verify the session with Stripe
    console.log("Retrieving Stripe session:", sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("Stripe session retrieved:", {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      metadata: session.metadata,
    });

    // Check payment status - allow 'paid' status
    if (session.payment_status !== "paid") {
      console.error("Payment not completed. Status:", session.payment_status);
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=payment_not_completed&status=${session.payment_status}`
      );
    }

    // Get Supabase client with service role (bypasses RLS)
    const supabase = getSupabaseClient();

    // Check if this is a family pack purchase
    let isFamilyPack = false;
    if (planId) {
      const { data: planData } = await supabase
        .from("credit_plans")
        .select("name, slug")
        .or(`slug.eq.${planId},id.eq.${planId}`)
        .maybeSingle();

      if (planData) {
        const planName = (planData.name || "").toLowerCase();
        const planSlug = (planData.slug || "").toLowerCase();
        isFamilyPack =
          planName.includes("family") || planSlug.includes("family");
      }
    }

    // Check if credits were already added (prevent duplicate credit additions)
    // We can check the session metadata or use a transaction log
    console.log("Fetching current credits for user:", userId);

    // Check if user is a principal first
    const { data: principalData, error: principalFetchError } = await supabase
      .from("Principals")
      .select("credits, id")
      .eq("user_id", userId)
      .maybeSingle();

    if (principalData) {
      // User is a principal, update principal credits
      const currentCredits = principalData.credits || 0;
      const newCredits = currentCredits + credits;

      console.log("Updating principal credits:", {
        userId,
        currentCredits,
        creditsToAdd: credits,
        newCredits,
      });

      const { data: updateData, error: updateError } = await supabase
        .from("Principals")
        .update({ credits: newCredits })
        .eq("user_id", userId)
        .select();

      if (updateError) {
        console.error("Error updating principal credits:", updateError);
        return NextResponse.redirect(
          `${baseUrl}/?tab=credits&error=update_error`
        );
      }

      console.log("Principal credits updated successfully:", updateData);
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&success=true&credits=${credits}`
      );
    }

    // Check if user is a student
    const { data: currentData, error: fetchError } = await supabase
      .from("Students")
      .select("credits, id, has_family_pack")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle instead of single to handle missing records

    if (fetchError) {
      console.error("Error fetching credits:", fetchError);
      console.error("Fetch error details:", {
        code: fetchError.code,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
      });
      return NextResponse.redirect(`${baseUrl}/?tab=credits&error=fetch_error`);
    }

    // If student record doesn't exist, create it with the credits
    if (!currentData) {
      console.log(
        "Student record not found, creating new record with credits:",
        credits
      );

      const { data: newStudentData, error: createError } = await supabase
        .from("Students")
        .insert({
          user_id: userId,
          credits: credits,
          has_family_pack: isFamilyPack,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating student record:", createError);
        console.error("Create error details:", {
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
        });
        return NextResponse.redirect(
          `${baseUrl}/?tab=credits&error=create_student_error`
        );
      }

      console.log(
        "Student record created successfully with credits:",
        newStudentData
      );

      // Send credit purchase notification
      console.log(
        "[NOTIFICATION] Starting credit purchase notification process..."
      );
      try {
        console.log("[NOTIFICATION] Fetching student info for userId:", userId);
        const { data: studentInfo, error: studentInfoError } = await supabase
          .from("Students")
          .select("email, first_name, last_name")
          .eq("user_id", userId)
          .single();

        if (studentInfoError) {
          console.error(
            "[NOTIFICATION] Error fetching student info:",
            studentInfoError
          );
        }

        console.log("[NOTIFICATION] Student info:", studentInfo);

        if (studentInfo?.email) {
          const studentName =
            `${studentInfo.first_name || ""} ${
              studentInfo.last_name || ""
            }`.trim() || "Student";
          const amount = session.amount_total
            ? `$${(session.amount_total / 100).toFixed(2)}`
            : "N/A";

          console.log("[NOTIFICATION] Calling sendCreditPurchaseEmail with:", {
            email: studentInfo.email,
            name: studentName,
            credits,
            amount,
            method: "Stripe",
          });

          const emailResult = await sendCreditPurchaseEmail(
            studentInfo.email,
            studentName,
            credits,
            amount,
            "Stripe"
          );

          console.log("[NOTIFICATION] Email result:", emailResult);

          if (emailResult.success) {
            console.log(
              "[NOTIFICATION] ✅ Credit purchase notification sent successfully"
            );
          } else {
            console.error(
              "[NOTIFICATION] ❌ Failed to send credit purchase notification:",
              emailResult.error
            );
          }
        } else {
          console.warn(
            "[NOTIFICATION] ⚠️ Student email not found, skipping notification. Student info:",
            studentInfo
          );
        }
      } catch (notifError) {
        console.error(
          "[NOTIFICATION] ❌ Exception in notification block:",
          notifError
        );
        console.error("[NOTIFICATION] Error stack:", notifError.stack);
        // Don't fail the payment if notification fails
      }

      // Redirect to credits page with success message
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&success=true&credits=${credits}`
      );
    }

    // Student record exists, update credits and family pack status if needed
    const currentCredits = currentData.credits || 0;
    const newCredits = currentCredits + credits;
    const updateDataObj = { credits: newCredits };

    // If this is a family pack purchase, set has_family_pack to true
    if (isFamilyPack) {
      updateDataObj.has_family_pack = true;
    }

    console.log("Updating credits:", {
      userId,
      currentCredits,
      creditsToAdd: credits,
      newCredits,
      isFamilyPack,
    });

    const { data: updateData, error: updateError } = await supabase
      .from("Students")
      .update(updateDataObj)
      .eq("user_id", userId)
      .select();

    if (updateError) {
      console.error("Error updating credits:", updateError);
      console.error("Update error details:", {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.redirect(
        `${baseUrl}/?tab=credits&error=update_error`
      );
    }

    console.log("Credits updated successfully:", updateData);

    // Send credit purchase notification
    console.log(
      "[NOTIFICATION] Starting credit purchase notification process..."
    );
    try {
      console.log("[NOTIFICATION] Fetching student info for userId:", userId);
      const { data: studentInfo, error: studentInfoError } = await supabase
        .from("Students")
        .select("email, first_name, last_name")
        .eq("user_id", userId)
        .single();

      if (studentInfoError) {
        console.error(
          "[NOTIFICATION] Error fetching student info:",
          studentInfoError
        );
      }

      console.log("[NOTIFICATION] Student info:", studentInfo);

      if (studentInfo?.email) {
        const studentName =
          `${studentInfo.first_name || ""} ${
            studentInfo.last_name || ""
          }`.trim() || "Student";
        const amount = session.amount_total
          ? `$${(session.amount_total / 100).toFixed(2)}`
          : "N/A";

        console.log("[NOTIFICATION] Calling sendCreditPurchaseEmail with:", {
          email: studentInfo.email,
          name: studentName,
          credits,
          amount,
          method: "Stripe",
        });

        const emailResult = await sendCreditPurchaseEmail(
          studentInfo.email,
          studentName,
          credits,
          amount,
          "Stripe"
        );

        console.log("[NOTIFICATION] Email result:", emailResult);

        if (emailResult.success) {
          console.log(
            "[NOTIFICATION] ✅ Credit purchase notification sent successfully"
          );
        } else {
          console.error(
            "[NOTIFICATION] ❌ Failed to send credit purchase notification:",
            emailResult.error
          );
        }
      } else {
        console.warn(
          "[NOTIFICATION] ⚠️ Student email not found, skipping notification. Student info:",
          studentInfo
        );
      }
    } catch (notifError) {
      console.error(
        "[NOTIFICATION] ❌ Exception in notification block:",
        notifError
      );
      console.error("[NOTIFICATION] Error stack:", notifError.stack);
      // Don't fail the payment if notification fails
    }

    // Redirect to credits page with success message
    return NextResponse.redirect(
      `${baseUrl}/?tab=credits&success=true&credits=${credits}`
    );
  } catch (error) {
    console.error("Stripe success handler error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      type: error.type,
      code: error.code,
    });
    const url = new URL(request.url);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;
    return NextResponse.redirect(
      `${baseUrl}/?tab=credits&error=processing_error&message=${encodeURIComponent(
        error.message
      )}`
    );
  }
}
