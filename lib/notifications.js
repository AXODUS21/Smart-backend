/**
 * Notification Service using Email.js
 * 
 * This service handles all email notifications in the tutoring platform.
 * Make sure to configure the following environment variables:
 * - NEXT_PUBLIC_EMAILJS_SERVICE_ID
 * - NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
 * 
 * Email.js Template IDs (configure in Email.js dashboard):
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_SIGNUP
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPLICATION
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_CREDIT_PURCHASE
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_LOW_CREDITS
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CREATED
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CANCELLED
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_ACCEPTED
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_DECLINED
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_REVIEW
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_PAYROLL_CREDITED
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_ANNOUNCEMENT
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_SESSION_LAPSE
 * - NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPROVAL
 */

import emailjs from '@emailjs/browser';

// Initialize Email.js (can be called once, but safe to call multiple times)
if (typeof window !== 'undefined') {
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  if (publicKey) {
    emailjs.init(publicKey);
  }
}

/**
 * Helper function to send email via Email.js
 * @param {string} serviceId - Email.js Service ID
 * @param {string} templateId - Email.js Template ID
 * @param {object} templateParams - Template parameters
 * @returns {Promise} Email.js response
 */
async function sendEmail(serviceId, templateId, templateParams) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
    if (!publicKey) {
      console.error('Email.js public key not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const response = await emailjs.send(serviceId, templateId, templateParams, publicKey);
    return { success: true, response };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Helper function to get all admin and superadmin emails
 */
async function getAdminEmails(supabase) {
  try {
    // Get all admin emails
    const { data: admins, error: adminError } = await supabase
      .from('admins')
      .select('email, user_id')
      .not('email', 'is', null);

    // Get all superadmin emails
    const { data: superadmins, error: superadminError } = await supabase
      .from('superadmins')
      .select('email, user_id')
      .not('email', 'is', null);

    const adminEmails = [];
    if (!adminError && admins) {
      adminEmails.push(...admins.map(a => a.email).filter(Boolean));
    }
    if (!superadminError && superadmins) {
      adminEmails.push(...superadmins.map(s => s.email).filter(Boolean));
    }

    return [...new Set(adminEmails)]; // Remove duplicates
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    return [];
  }
}

/**
 * 1. Notification upon signup (student/tutor/admin/superadmin)
 * @param {object} params - Signup notification parameters
 * @param {string} params.email - User email
 * @param {string} params.firstName - User first name
 * @param {string} params.lastName - User last name
 * @param {string} params.userType - User type (student/tutor/admin/superadmin)
 */
export async function notifySignup({ email, firstName, lastName, userType }) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_SIGNUP;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for signup notification');
    return { success: false, error: 'Template not configured' };
  }

  const fullName = `${firstName || ''} ${lastName || ''}`.trim() || email;
  const templateParams = {
    to_email: email,
    user_name: fullName,
    user_type: userType || 'user',
    first_name: firstName || '',
    last_name: lastName || '',
    user_email: email,
  };

  return await sendEmail(serviceId, templateId, templateParams);
}

/**
 * 2. Tutor sending an application (admin/superadmin)
 * @param {object} params - Tutor application parameters
 * @param {string} params.tutorName - Tutor full name
 * @param {string} params.tutorEmail - Tutor email
 * @param {string} params.applicationId - Application ID
 * @param {object} supabase - Supabase client instance
 */
export async function notifyTutorApplication({ tutorName, tutorEmail, applicationId, supabase }) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPLICATION;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for tutor application notification');
    return { success: false, error: 'Template not configured' };
  }

  const adminEmails = await getAdminEmails(supabase);
  
  if (adminEmails.length === 0) {
    console.warn('No admin emails found for tutor application notification');
    return { success: false, error: 'No admin emails found' };
  }

  // Send to all admins and superadmins
  const results = [];
  for (const adminEmail of adminEmails) {
    const templateParams = {
      to_email: adminEmail,
      tutor_name: tutorName,
      tutor_email: tutorEmail,
      application_id: applicationId,
    };
    const result = await sendEmail(serviceId, templateId, templateParams);
    results.push({ email: adminEmail, ...result });
  }

  return { success: true, results };
}

/**
 * 3. Student buying credits (student/admin/superadmin)
 * @param {object} params - Credit purchase parameters
 * @param {string} params.studentEmail - Student email
 * @param {string} params.studentName - Student name
 * @param {number} params.credits - Number of credits purchased
 * @param {number} params.amount - Purchase amount
 * @param {string} params.currency - Currency (USD/PHP)
 * @param {object} supabase - Supabase client instance
 */
export async function notifyCreditPurchase({ studentEmail, studentName, credits, amount, currency = 'USD', supabase }) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_CREDIT_PURCHASE;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for credit purchase notification');
    return { success: false, error: 'Template not configured' };
  }

  // Notify student
  const studentParams = {
    to_email: studentEmail,
    student_name: studentName || studentEmail,
    credits_purchased: credits.toString(),
    amount: amount.toString(),
    currency: currency,
    purchase_date: new Date().toLocaleDateString(),
  };
  const studentResult = await sendEmail(serviceId, templateId, studentParams);

  // Notify admins and superadmins
  const adminEmails = await getAdminEmails(supabase);
  const adminResults = [];
  for (const adminEmail of adminEmails) {
    const adminParams = {
      to_email: adminEmail,
      student_name: studentName || studentEmail,
      student_email: studentEmail,
      credits_purchased: credits.toString(),
      amount: amount.toString(),
      currency: currency,
      purchase_date: new Date().toLocaleDateString(),
    };
    const result = await sendEmail(serviceId, templateId, adminParams);
    adminResults.push({ email: adminEmail, ...result });
  }

  return { 
    success: true, 
    student: studentResult, 
    admins: adminResults 
  };
}

/**
 * 4. Student low credits or 1 credit remaining (student)
 * @param {object} params - Low credits notification parameters
 * @param {string} params.studentEmail - Student email
 * @param {string} params.studentName - Student name
 * @param {number} params.currentCredits - Current credit balance
 */
export async function notifyLowCredits({ studentEmail, studentName, currentCredits }) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_LOW_CREDITS;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for low credits notification');
    return { success: false, error: 'Template not configured' };
  }

  const templateParams = {
    to_email: studentEmail,
    student_name: studentName || studentEmail,
    current_credits: currentCredits.toString(),
    warning_level: currentCredits === 1 ? 'critical' : 'low',
  };

  return await sendEmail(serviceId, templateId, templateParams);
}

/**
 * 5. Student booking/cancelling a tutoring session (tutors/admin/superadmin)
 * @param {object} params - Booking notification parameters
 * @param {string} params.action - 'created' or 'cancelled'
 * @param {string} params.studentEmail - Student email
 * @param {string} params.studentName - Student name
 * @param {string} params.tutorEmail - Tutor email
 * @param {string} params.tutorName - Tutor name
 * @param {string} params.subject - Subject
 * @param {string} params.sessionDate - Session date/time
 * @param {number} params.duration - Duration in minutes
 * @param {number} params.credits - Credits required
 * @param {string} params.cancellationReason - Cancellation reason (if cancelled)
 * @param {object} supabase - Supabase client instance
 */
export async function notifyBookingAction({ 
  action, 
  studentEmail, 
  studentName, 
  tutorEmail, 
  tutorName, 
  subject, 
  sessionDate, 
  duration, 
  credits,
  cancellationReason = '',
  supabase 
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = action === 'created' 
    ? process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CREATED
    : process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CANCELLED;

  if (!serviceId || !templateId) {
    console.warn(`Email.js templates not configured for booking ${action} notification`);
    return { success: false, error: 'Template not configured' };
  }

  const results = [];

  // Notify tutor
  const tutorParams = {
    to_email: tutorEmail,
    tutor_name: tutorName,
    student_name: studentName,
    student_email: studentEmail,
    subject: subject,
    session_date: sessionDate,
    duration: `${duration} minutes`,
    credits: credits.toString(),
    cancellation_reason: cancellationReason,
    action_type: action,
  };
  const tutorResult = await sendEmail(serviceId, templateId, tutorParams);
  results.push({ recipient: 'tutor', email: tutorEmail, ...tutorResult });

  // Notify admins and superadmins
  const adminEmails = await getAdminEmails(supabase);
  for (const adminEmail of adminEmails) {
    const adminParams = {
      to_email: adminEmail,
      tutor_name: tutorName,
      tutor_email: tutorEmail,
      student_name: studentName,
      student_email: studentEmail,
      subject: subject,
      session_date: sessionDate,
      duration: `${duration} minutes`,
      credits: credits.toString(),
      cancellation_reason: cancellationReason,
      action_type: action,
    };
    const adminResult = await sendEmail(serviceId, templateId, adminParams);
    results.push({ recipient: 'admin', email: adminEmail, ...adminResult });
  }

  return { success: true, results };
}

/**
 * 6. Tutor accepting/declining a tutoring session (student/admin/superadmin)
 * @param {object} params - Session response parameters
 * @param {string} params.action - 'accepted' or 'declined'
 * @param {string} params.studentEmail - Student email
 * @param {string} params.studentName - Student name
 * @param {string} params.tutorEmail - Tutor email
 * @param {string} params.tutorName - Tutor name
 * @param {string} params.subject - Subject
 * @param {string} params.sessionDate - Session date/time
 * @param {number} params.duration - Duration in minutes
 * @param {number} params.credits - Credits required
 * @param {string} params.meetingLink - Meeting link (if accepted)
 * @param {object} supabase - Supabase client instance
 */
export async function notifySessionResponse({ 
  action, 
  studentEmail, 
  studentName, 
  tutorEmail, 
  tutorName, 
  subject, 
  sessionDate, 
  duration, 
  credits,
  meetingLink = '',
  supabase 
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = action === 'accepted' 
    ? process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_ACCEPTED
    : process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_DECLINED;

  if (!serviceId || !templateId) {
    console.warn(`Email.js templates not configured for session ${action} notification`);
    return { success: false, error: 'Template not configured' };
  }

  const results = [];

  // Notify student
  const studentParams = {
    to_email: studentEmail,
    student_name: studentName,
    tutor_name: tutorName,
    tutor_email: tutorEmail,
    subject: subject,
    session_date: sessionDate,
    duration: `${duration} minutes`,
    credits: credits.toString(),
    meeting_link: meetingLink,
    action_type: action,
  };
  const studentResult = await sendEmail(serviceId, templateId, studentParams);
  results.push({ recipient: 'student', email: studentEmail, ...studentResult });

  // Notify admins and superadmins
  const adminEmails = await getAdminEmails(supabase);
  for (const adminEmail of adminEmails) {
    const adminParams = {
      to_email: adminEmail,
      tutor_name: tutorName,
      tutor_email: tutorEmail,
      student_name: studentName,
      student_email: studentEmail,
      subject: subject,
      session_date: sessionDate,
      duration: `${duration} minutes`,
      credits: credits.toString(),
      meeting_link: meetingLink,
      action_type: action,
    };
    const adminResult = await sendEmail(serviceId, templateId, adminParams);
    results.push({ recipient: 'admin', email: adminEmail, ...adminResult });
  }

  return { success: true, results };
}

/**
 * 7. Tutor writing a review to student (student)
 * @param {object} params - Tutor review parameters
 * @param {string} params.studentEmail - Student email
 * @param {string} params.studentName - Student name
 * @param {string} params.tutorName - Tutor name
 * @param {string} params.subject - Subject
 * @param {string} params.sessionDate - Session date
 * @param {string} params.review - Review text
 */
export async function notifyTutorReview({ 
  studentEmail, 
  studentName, 
  tutorName, 
  subject, 
  sessionDate, 
  review 
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_REVIEW;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for tutor review notification');
    return { success: false, error: 'Template not configured' };
  }

  const templateParams = {
    to_email: studentEmail,
    student_name: studentName || studentEmail,
    tutor_name: tutorName,
    subject: subject,
    session_date: sessionDate,
    review_text: review,
  };

  return await sendEmail(serviceId, templateId, templateParams);
}

/**
 * 8. Payroll is credited (tutor/admin/superadmin)
 * @param {object} params - Payroll notification parameters
 * @param {string} params.tutorEmail - Tutor email
 * @param {string} params.tutorName - Tutor name
 * @param {number} params.amount - Amount credited
 * @param {string} params.currency - Currency
 * @param {string} params.period - Payroll period
 * @param {object} supabase - Supabase client instance
 */
export async function notifyPayrollCredited({ 
  tutorEmail, 
  tutorName, 
  amount, 
  currency = 'USD', 
  period,
  supabase 
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_PAYROLL_CREDITED;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for payroll notification');
    return { success: false, error: 'Template not configured' };
  }

  const results = [];

  // Notify tutor
  const tutorParams = {
    to_email: tutorEmail,
    tutor_name: tutorName,
    amount: amount.toString(),
    currency: currency,
    payroll_period: period || new Date().toLocaleDateString(),
    credit_date: new Date().toLocaleDateString(),
  };
  const tutorResult = await sendEmail(serviceId, templateId, tutorParams);
  results.push({ recipient: 'tutor', email: tutorEmail, ...tutorResult });

  // Notify admins and superadmins
  const adminEmails = await getAdminEmails(supabase);
  for (const adminEmail of adminEmails) {
    const adminParams = {
      to_email: adminEmail,
      tutor_name: tutorName,
      tutor_email: tutorEmail,
      amount: amount.toString(),
      currency: currency,
      payroll_period: period || new Date().toLocaleDateString(),
      credit_date: new Date().toLocaleDateString(),
    };
    const adminResult = await sendEmail(serviceId, templateId, adminParams);
    results.push({ recipient: 'admin', email: adminEmail, ...adminResult });
  }

  return { success: true, results };
}

/**
 * 9. Announcement feature (student/tutor/admin/superadmin)
 * @param {object} params - Announcement parameters
 * @param {string} params.title - Announcement title
 * @param {string} params.message - Announcement message
 * @param {string} params.priority - Priority level (normal/high/urgent)
 * @param {array} params.targetAudience - Target audience array ['students', 'tutors', 'admins', 'superadmins']
 * @param {object} supabase - Supabase client instance
 */
export async function notifyAnnouncement({ 
  title, 
  message, 
  priority = 'normal', 
  targetAudience = ['students', 'tutors'],
  supabase 
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ANNOUNCEMENT;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for announcement notification');
    return { success: false, error: 'Template not configured' };
  }

  const results = [];

  // Get emails based on target audience
  const emailList = [];

  if (targetAudience.includes('students')) {
    const { data: students } = await supabase
      .from('Students')
      .select('email')
      .not('email', 'is', null);
    if (students) {
      emailList.push(...students.map(s => s.email).filter(Boolean));
    }
  }

  if (targetAudience.includes('tutors')) {
    const { data: tutors } = await supabase
      .from('Tutors')
      .select('email')
      .not('email', 'is', null);
    if (tutors) {
      emailList.push(...tutors.map(t => t.email).filter(Boolean));
    }
  }

  if (targetAudience.includes('admins') || targetAudience.includes('superadmins')) {
    const adminEmails = await getAdminEmails(supabase);
    emailList.push(...adminEmails);
  }

  // Remove duplicates
  const uniqueEmails = [...new Set(emailList)];

  // Send to all recipients
  for (const email of uniqueEmails) {
    const templateParams = {
      to_email: email,
      announcement_title: title,
      announcement_message: message,
      priority: priority,
      announcement_date: new Date().toLocaleDateString(),
    };
    const result = await sendEmail(serviceId, templateId, templateParams);
    results.push({ email, ...result });
  }

  return { success: true, results, totalSent: uniqueEmails.length };
}

/**
 * 10. Book session lapse without tutor/student response (student/tutor/admin/superadmin)
 * @param {object} params - Session lapse parameters
 * @param {string} params.studentEmail - Student email
 * @param {string} params.studentName - Student name
 * @param {string} params.tutorEmail - Tutor email
 * @param {string} params.tutorName - Tutor name
 * @param {string} params.subject - Subject
 * @param {string} params.sessionDate - Session date/time
 * @param {string} params.lapseReason - Reason for lapse (tutor_no_response/student_no_response)
 * @param {object} supabase - Supabase client instance
 */
export async function notifySessionLapse({ 
  studentEmail, 
  studentName, 
  tutorEmail, 
  tutorName, 
  subject, 
  sessionDate,
  lapseReason,
  supabase 
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_SESSION_LAPSE;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for session lapse notification');
    return { success: false, error: 'Template not configured' };
  }

  const results = [];

  // Notify both student and tutor
  const studentParams = {
    to_email: studentEmail,
    student_name: studentName,
    tutor_name: tutorName,
    tutor_email: tutorEmail,
    subject: subject,
    session_date: sessionDate,
    lapse_reason: lapseReason,
  };
  const studentResult = await sendEmail(serviceId, templateId, studentParams);
  results.push({ recipient: 'student', email: studentEmail, ...studentResult });

  const tutorParams = {
    to_email: tutorEmail,
    tutor_name: tutorName,
    student_name: studentName,
    student_email: studentEmail,
    subject: subject,
    session_date: sessionDate,
    lapse_reason: lapseReason,
  };
  const tutorResult = await sendEmail(serviceId, templateId, tutorParams);
  results.push({ recipient: 'tutor', email: tutorEmail, ...tutorResult });

  // Notify admins and superadmins
  const adminEmails = await getAdminEmails(supabase);
  for (const adminEmail of adminEmails) {
    const adminParams = {
      to_email: adminEmail,
      tutor_name: tutorName,
      tutor_email: tutorEmail,
      student_name: studentName,
      student_email: studentEmail,
      subject: subject,
      session_date: sessionDate,
      lapse_reason: lapseReason,
    };
    const adminResult = await sendEmail(serviceId, templateId, adminParams);
    results.push({ recipient: 'admin', email: adminEmail, ...adminResult });
  }

  return { success: true, results };
}

/**
 * 11. Approval of tutor application (tutors)
 * @param {object} params - Tutor approval parameters
 * @param {string} params.tutorEmail - Tutor email
 * @param {string} params.tutorName - Tutor name
 * @param {string} params.status - Approval status ('approved' or 'rejected')
 * @param {string} params.notes - Approval notes (optional)
 */
export async function notifyTutorApproval({ 
  tutorEmail, 
  tutorName, 
  status, 
  notes = '' 
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPROVAL;

  if (!serviceId || !templateId) {
    console.warn('Email.js templates not configured for tutor approval notification');
    return { success: false, error: 'Template not configured' };
  }

  const templateParams = {
    to_email: tutorEmail,
    tutor_name: tutorName,
    approval_status: status,
    approval_notes: notes,
    approval_date: new Date().toLocaleDateString(),
  };

  return await sendEmail(serviceId, templateId, templateParams);
}

