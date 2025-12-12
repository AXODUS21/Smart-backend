/**
 * Notification Service
 * Handles all email notifications using Resend
 */

/**
 * Send notification via API route
 * @param {string} type - Notification type
 * @param {object} data - Notification data
 * @param {string[]} recipients - Array of email addresses
 * @param {string} baseUrl - Optional base URL for server-side calls
 * @returns {Promise<object>} Response from API
 */
export async function sendNotification(type, data, recipients, baseUrl = null) {
  try {
    // Determine the API URL - use absolute URL if baseUrl is provided (server-side) or if we're in a server context
    let apiUrl = '/api/notifications/send';
    if (baseUrl) {
      apiUrl = `${baseUrl}/api/notifications/send`;
    } else if (typeof window === 'undefined') {
      // Server-side context - try to construct URL from environment
      const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      apiUrl = `${envBaseUrl}/api/notifications/send`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        data,
        recipients: Array.isArray(recipients) ? recipients : [recipients],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * 1. Notification upon signup
 * Recipients: student/tutor/admin/superadmin (the user who signed up)
 */
export async function notifySignup(userEmail, userType, firstName, lastName) {
  return sendNotification('signup', {
    userEmail,
    userType,
    firstName,
    lastName,
  }, [userEmail]);
}

/**
 * 2. Tutor sending an application
 * Recipients: admin/superadmin
 */
export async function notifyTutorApplication(tutorName, tutorEmail, applicationId) {
  const { getUserEmailsByRole } = await import('./notifications');
  const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);
  
  return sendNotification('tutor_application', {
    tutorName,
    tutorEmail,
    applicationId,
  }, adminEmails);
}

/**
 * 3. Student buying credits
 * Recipients: student/admin/superadmin
 */
export async function notifyCreditPurchase(studentEmail, studentName, creditsPurchased, amount, paymentMethod, baseUrl = null) {
  const { getUserEmailsByRole } = await import('./notifications');
  const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);
  
  return sendNotification('credit_purchase', {
    studentEmail,
    studentName,
    creditsPurchased,
    amount,
    paymentMethod,
  }, [studentEmail, ...adminEmails], baseUrl);
}

/**
 * 4. Student low credits or 1 credit remaining
 * Recipients: student
 */
export async function notifyLowCredits(studentEmail, studentName, remainingCredits) {
  return sendNotification('low_credits', {
    studentEmail,
    studentName,
    remainingCredits,
  }, [studentEmail]);
}

/**
 * 5. Student booking/cancelling a tutoring session
 * Recipients: tutors/admin/superadmin
 */
export async function notifySessionBooking(studentEmail, studentName, tutorEmail, tutorName, sessionDate, sessionTime, subject, action) {
  const { getUserEmailsByRole } = await import('./notifications');
  const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);
  
  const recipients = [tutorEmail, ...adminEmails].filter(Boolean);
  
  return sendNotification('session_booking', {
    studentEmail,
    studentName,
    tutorEmail,
    tutorName,
    sessionDate,
    sessionTime,
    subject,
    action, // 'booked' or 'cancelled'
  }, recipients);
}

/**
 * 6. Tutor accepting/declining a tutoring session
 * Recipients: student/admin/superadmin
 */
export async function notifySessionResponse(tutorEmail, tutorName, studentEmail, studentName, sessionDate, sessionTime, subject, action) {
  const { getUserEmailsByRole } = await import('./notifications');
  const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);
  
  const recipients = [studentEmail, ...adminEmails].filter(Boolean);
  
  return sendNotification('session_response', {
    tutorEmail,
    tutorName,
    studentEmail,
    studentName,
    sessionDate,
    sessionTime,
    subject,
    action, // 'accepted' or 'declined'
  }, recipients);
}

/**
 * 7. Tutor writing a review to student
 * Recipients: student
 */
export async function notifyTutorReview(tutorName, studentEmail, studentName, sessionDate, subject, rating, review) {
  return sendNotification('tutor_review', {
    tutorName,
    studentEmail,
    studentName,
    sessionDate,
    subject,
    rating,
    review,
  }, [studentEmail]);
}

/**
 * 8. Payroll is credited
 * Recipients: tutor/admin/superadmin
 */
export async function notifyPayrollCredited(tutorEmail, tutorName, amount, period) {
  const { getUserEmailsByRole } = await import('./notifications');
  const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);
  
  const recipients = [tutorEmail, ...adminEmails].filter(Boolean);
  
  return sendNotification('payroll_credited', {
    tutorEmail,
    tutorName,
    amount,
    period,
  }, recipients);
}

/**
 * 9. Announcement feature
 * Recipients: student/tutor/admin/superadmin (all users or specific roles)
 */
export async function notifyAnnouncement(announcementTitle, announcementContent, roles = ['student', 'tutor', 'admin', 'superadmin']) {
  const { getUserEmailsByRole } = await import('./notifications');
  const allEmails = await getUserEmailsByRole(roles);
  
  return sendNotification('announcement', {
    announcementTitle,
    announcementContent,
  }, allEmails);
}

/**
 * 10. Book session lapse without the tutor/student respond
 * Recipients: student/tutor/admin/superadmin
 */
export async function notifySessionLapse(studentEmail, studentName, tutorEmail, tutorName, sessionDate, sessionTime, subject, lapsedBy) {
  const { getUserEmailsByRole } = await import('./notifications');
  const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);
  
  const recipients = [studentEmail, tutorEmail, ...adminEmails].filter(Boolean);
  
  return sendNotification('session_lapse', {
    studentEmail,
    studentName,
    tutorEmail,
    tutorName,
    sessionDate,
    sessionTime,
    subject,
    lapsedBy, // 'student' or 'tutor'
  }, recipients);
}

/**
 * 11. Approval of tutor application
 * Recipients: tutors
 */
export async function notifyTutorApplicationApproval(tutorEmail, tutorName, applicationId, status) {
  return sendNotification('tutor_application_approval', {
    tutorEmail,
    tutorName,
    applicationId,
    status, // 'approved' or 'rejected'
  }, [tutorEmail]);
}


