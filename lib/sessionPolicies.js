import { supabase } from "./supabase";

/**
 * Handle no-show session - forfeit credits
 * @param {number} sessionId - The session ID
 * @param {string} noShowType - 'student-no-show' or 'tutor-no-show'
 */
export async function handleNoShow(sessionId, noShowType) {
  try {
    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from("Schedules")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Check if session is already marked as successful/completed by tutor
    if (noShowType === "tutor-no-show" && 
        (session.session_status === "successful" || session.session_action === "review-submitted")) {
      return {
        success: false,
        isConflict: true,
        message: "This session has already been marked as successful by the tutor. Please contact support if you wish to dispute this.",
      };
    }

    // Update session with no-show status
    const { error: updateError } = await supabase
      .from("Schedules")
      .update({
        no_show_type: noShowType,
        session_status: noShowType,
        session_action: noShowType,
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    // If student no-show, tutor should still get credits
    if (noShowType === "student-no-show") {
      // Award credits to tutor
      const amount = session.credits_required || 0;
      if (session.tutor_id && amount > 0) {
        const { data: tutor, error: tutorError } = await supabase
          .from("Tutors")
          .select("id, credits")
          .eq("id", session.tutor_id)
          .single();

        if (tutorError) throw tutorError;

        const currentCredits = parseFloat(tutor.credits || 0);
        const creditsEarned = parseFloat(amount);
        const newCredits = currentCredits + creditsEarned;

        const { error: updateCreditsError } = await supabase
          .from("Tutors")
          .update({ credits: newCredits })
          .eq("id", tutor.id);

        if (updateCreditsError) throw updateCreditsError;

        console.log(
          `Tutor ${tutor.id} earned ${creditsEarned} credits for student no-show on session ${sessionId}. New balance: ${newCredits}`
        );
      }

      return {
        success: true,
        message: "Student no-show recorded. Tutor will receive credits.",
      };
    }

    // If tutor no-show, refund credits to Principal or Student
    if (noShowType === "tutor-no-show") {
      const amount = session.credits_required || 0;
      if (session.principal_user_id) {
        const { data: principal, error: principalError } = await supabase
          .from("Principals")
          .select("credits")
          .eq("user_id", session.principal_user_id)
          .single();
        if (principalError) throw principalError;
        const newCredits = (principal.credits || 0) + amount;
        const { error: refundError } = await supabase
          .from("Principals")
          .update({ credits: newCredits })
          .eq("user_id", session.principal_user_id);
        if (refundError) throw refundError;
      } else if (session.student_id) {
        const { data: student, error: studentError } = await supabase
          .from("Students")
          .select("credits")
          .eq("id", session.student_id)
          .single();
        if (studentError) throw studentError;
        const newCredits = (student.credits || 0) + amount;
        const { error: refundError } = await supabase
          .from("Students")
          .update({ credits: newCredits })
          .eq("id", session.student_id);
        if (refundError) throw refundError;
      }

      await supabase
        .from("Schedules")
        .update({ credits_refunded: amount })
        .eq("id", sessionId);

      return {
        success: true,
        message: "Tutor no-show recorded. Credits refunded.",
        creditsRefunded: amount,
      };
    }
  } catch (error) {
    console.error("Error handling no-show:", error);
    throw error;
  }
}

/**
 * Check if a session can be cancelled with full refund
 * @param {Date} sessionStartTime - Session start time
 * @param {number} requiredHoursNotice - Hours notice required (default 24)
 */
export function canCancelWithFullRefund(sessionStartTime, requiredHoursNotice = 24) {
  const now = new Date();
  const hoursUntilSession = (sessionStartTime - now) / (1000 * 60 * 60);
  return hoursUntilSession >= requiredHoursNotice;
}

/**
 * Check if a session can be rescheduled
 * @param {Date} sessionStartTime - Session start time
 * @param {number} requiredHoursNotice - Hours notice required (default 24)
 */
export function canRescheduleSession(sessionStartTime, requiredHoursNotice = 24) {
  const now = new Date();
  const hoursUntilSession = (sessionStartTime - now) / (1000 * 60 * 60);
  return hoursUntilSession >= requiredHoursNotice;
}

/**
 * Get hours until session
 * @param {Date} sessionStartTime - Session start time
 */
export function getHoursUntilSession(sessionStartTime) {
  const now = new Date();
  return Math.round((sessionStartTime - now) / (1000 * 60 * 60) * 10) / 10;
}

/**
 * Check if session meets minimum advance booking requirement
 * @param {Date} sessionStartTime - Session start time
 * @param {number} minHoursAdvance - Minimum hours in advance (default 2)
 */
export function meetsMinimumAdvanceBooking(sessionStartTime, minHoursAdvance = 2) {
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + minHoursAdvance * 60 * 60 * 1000);
  return sessionStartTime >= minBookingTime;
}

/**
 * Check daily session limit for a student
 * @param {number} studentId - Student ID
 * @param {Date} date - Date to check
 * @param {number} maxSessions - Maximum sessions allowed per day
 */
export async function checkDailySessionLimit(studentId, date, maxSessions = 5) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: sessions, error } = await supabase
      .from("Schedules")
      .select("id")
      .eq("student_id", studentId)
      .gte("start_time_utc", startOfDay.toISOString())
      .lte("start_time_utc", endOfDay.toISOString())
      .in("status", ["pending", "confirmed"]);

    if (error) throw error;

    const sessionCount = sessions?.length || 0;
    return {
      count: sessionCount,
      limit: maxSessions,
      canBook: sessionCount < maxSessions,
    };
  } catch (error) {
    console.error("Error checking daily session limit:", error);
    throw error;
  }
}

/**
 * Check daily session limit for a tutor
 * @param {number} tutorId - Tutor ID
 * @param {Date} date - Date to check
 * @param {number} maxSessions - Maximum sessions allowed per day
 */
export async function checkTutorDailySessionLimit(tutorId, date, maxSessions = 8) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: sessions, error } = await supabase
      .from("Schedules")
      .select("id")
      .eq("tutor_id", tutorId)
      .gte("start_time_utc", startOfDay.toISOString())
      .lte("start_time_utc", endOfDay.toISOString())
      .in("status", ["pending", "confirmed"]);

    if (error) throw error;

    const sessionCount = sessions?.length || 0;
    return {
      count: sessionCount,
      limit: maxSessions,
      canBook: sessionCount < maxSessions,
    };
  } catch (error) {
    console.error("Error checking tutor daily session limit:", error);
    throw error;
  }
}
