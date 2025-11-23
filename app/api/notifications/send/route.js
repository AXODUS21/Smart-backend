import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email templates mapping
const EMAIL_TEMPLATES = {
  signup: {
    subject: (data) => `Welcome to ${process.env.APP_NAME || 'Smart Tutoring Platform'}!`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.firstName || 'there'}!</h2>
            <p>Thank you for signing up as a <strong>${data.userType}</strong> on our platform.</p>
            <p>Your account has been successfully created. You can now start using all the features available to you.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" class="button">Get Started</a>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">If you didn't create this account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  tutor_application: {
    subject: (data) => `New Tutor Application: ${data.tutorName}`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Tutor Application</h1>
          </div>
          <div class="content">
            <p>A new tutor application has been submitted:</p>
            <div class="info-box">
              <p><strong>Name:</strong> ${data.tutorName}</p>
              <p><strong>Email:</strong> ${data.tutorEmail}</p>
              <p><strong>Application ID:</strong> ${data.applicationId}</p>
            </div>
            <p>Please review the application in the admin dashboard.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">Review Application</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  credit_purchase: {
    subject: (data) => `Credits Purchased Successfully`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Credits Purchased</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.studentName}!</h2>
            <p>Your credit purchase was successful.</p>
            <div class="info-box">
              <p><strong>Credits Purchased:</strong> ${data.creditsPurchased}</p>
              <p><strong>Amount Paid:</strong> ${data.amount}</p>
              <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
            </div>
            <p>Your credits have been added to your account and are ready to use.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Credits</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  low_credits: {
    subject: (data) => `Low Credits Alert - ${data.remainingCredits} Credit${data.remainingCredits !== 1 ? 's' : ''} Remaining`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fef2f2; border: 2px solid #ef4444; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Low Credits Alert</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.studentName}!</h2>
            <div class="warning-box">
              <p style="font-size: 18px; font-weight: bold; color: #ef4444;">You have ${data.remainingCredits} credit${data.remainingCredits !== 1 ? 's' : ''} remaining.</p>
            </div>
            <p>To continue booking tutoring sessions, please purchase more credits.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">Purchase Credits</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  session_booking: {
    subject: (data) => `Session ${data.action === 'booked' ? 'Booked' : 'Cancelled'}: ${data.subject}`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${data.action === 'booked' ? '#3b82f6' : '#ef4444'}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-left: 4px solid ${data.action === 'booked' ? '#3b82f6' : '#ef4444'}; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Session ${data.action === 'booked' ? 'Booked' : 'Cancelled'}</h1>
          </div>
          <div class="content">
            <p>A tutoring session has been ${data.action}:</p>
            <div class="info-box">
              <p><strong>Student:</strong> ${data.studentName}</p>
              <p><strong>Tutor:</strong> ${data.tutorName}</p>
              <p><strong>Subject:</strong> ${data.subject}</p>
              <p><strong>Date:</strong> ${data.sessionDate}</p>
              <p><strong>Time:</strong> ${data.sessionTime}</p>
            </div>
            ${data.action === 'booked' ? '<p>The tutor will be notified and can accept or decline the session.</p>' : '<p>The session has been cancelled and credits have been refunded if applicable.</p>'}
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: ${data.action === 'booked' ? '#3b82f6' : '#ef4444'}; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Session</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  session_response: {
    subject: (data) => `Tutor ${data.action === 'accepted' ? 'Accepted' : 'Declined'} Your Session`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${data.action === 'accepted' ? '#10b981' : '#ef4444'}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-left: 4px solid ${data.action === 'accepted' ? '#10b981' : '#ef4444'}; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Session ${data.action === 'accepted' ? 'Accepted' : 'Declined'}</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.studentName}!</h2>
            <p>Tutor <strong>${data.tutorName}</strong> has ${data.action} your tutoring session request.</p>
            <div class="info-box">
              <p><strong>Subject:</strong> ${data.subject}</p>
              <p><strong>Date:</strong> ${data.sessionDate}</p>
              <p><strong>Time:</strong> ${data.sessionTime}</p>
            </div>
            ${data.action === 'accepted' ? '<p>Your session is confirmed! Please make sure to attend on time.</p>' : '<p>Your credits have been refunded. You can book another session with a different tutor.</p>'}
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: ${data.action === 'accepted' ? '#10b981' : '#ef4444'}; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Session</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  tutor_review: {
    subject: (data) => `Review from ${data.tutorName}`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .review-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .rating { color: #fbbf24; font-size: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Review Received</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.studentName}!</h2>
            <p><strong>${data.tutorName}</strong> has left you a review for your session:</p>
            <div class="review-box">
              <p><strong>Subject:</strong> ${data.subject}</p>
              <p><strong>Date:</strong> ${data.sessionDate}</p>
              <p><strong>Rating:</strong> <span class="rating">${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}</span> (${data.rating}/5)</p>
              ${data.review ? `<p><strong>Review:</strong><br>${data.review}</p>` : ''}
            </div>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Review</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  payroll_credited: {
    subject: (data) => `Payroll Credited: ${data.amount}`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payroll Credited</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.tutorName}!</h2>
            <p>Your payroll has been credited successfully.</p>
            <div class="info-box">
              <p><strong>Amount:</strong> ${data.amount}</p>
              <p><strong>Period:</strong> ${data.period}</p>
            </div>
            <p>The payment has been processed and should appear in your account shortly.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Payroll</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  announcement: {
    subject: (data) => data.announcementTitle,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .announcement-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #6366f1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Announcement</h1>
          </div>
          <div class="content">
            <div class="announcement-box">
              <h2>${data.announcementTitle}</h2>
              <div style="margin-top: 15px;">${data.announcementContent.replace(/\n/g, '<br>')}</div>
            </div>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Platform</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  session_lapse: {
    subject: (data) => `Session Lapsed: ${data.subject}`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Session Lapsed</h1>
          </div>
          <div class="content">
            <p>A tutoring session has lapsed without a response from the ${data.lapsedBy}.</p>
            <div class="warning-box">
              <p><strong>Student:</strong> ${data.studentName}</p>
              <p><strong>Tutor:</strong> ${data.tutorName}</p>
              <p><strong>Subject:</strong> ${data.subject}</p>
              <p><strong>Date:</strong> ${data.sessionDate}</p>
              <p><strong>Time:</strong> ${data.sessionTime}</p>
              <p><strong>Lapsed By:</strong> ${data.lapsedBy === 'student' ? 'Student did not respond' : 'Tutor did not respond'}</p>
            </div>
            <p>Please review this session and take appropriate action.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Session</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
  tutor_application_approval: {
    subject: (data) => `Tutor Application ${data.status === 'approved' ? 'Approved' : 'Rejected'}`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${data.status === 'approved' ? '#10b981' : '#ef4444'}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-left: 4px solid ${data.status === 'approved' ? '#10b981' : '#ef4444'}; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application ${data.status === 'approved' ? 'Approved' : 'Rejected'}</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.tutorName}!</h2>
            <p>Your tutor application has been ${data.status}.</p>
            <div class="info-box">
              <p><strong>Application ID:</strong> ${data.applicationId}</p>
              <p><strong>Status:</strong> ${data.status === 'approved' ? 'Approved ✓' : 'Rejected ✗'}</p>
            </div>
            ${data.status === 'approved' ? '<p>Congratulations! You can now start accepting tutoring sessions on the platform.</p>' : '<p>Thank you for your interest. If you have any questions, please contact support.</p>'}
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: ${data.status === 'approved' ? '#10b981' : '#ef4444'}; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">${data.status === 'approved' ? 'Get Started' : 'Contact Support'}</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },
};

export async function POST(request) {
  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Check if from email is configured
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev';
    
    const body = await request.json();
    const { type, data, recipients } = body;

    if (!type || !data || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: type, data, and recipients array' },
        { status: 400 }
      );
    }

    // Get email template
    const template = EMAIL_TEMPLATES[type];
    if (!template) {
      return NextResponse.json(
        { error: `Unknown notification type: ${type}` },
        { status: 400 }
      );
    }

    // Prepare email content
    const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject;
    const html = typeof template.html === 'function' ? template.html(data) : template.html;

    // Send emails to all recipients
    const emailPromises = recipients.map(async (email) => {
      try {
        const { data: emailData, error } = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: subject,
          html: html,
        });

        if (error) {
          console.error(`Error sending email to ${email}:`, error);
          return { email, success: false, error: error.message };
        }

        return { email, success: true, id: emailData?.id };
      } catch (err) {
        console.error(`Exception sending email to ${email}:`, err);
        return { email, success: false, error: err.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      sent: successful.length,
      failed: failed.length,
      results: results,
    });
  } catch (error) {
    console.error('Error in notification API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

