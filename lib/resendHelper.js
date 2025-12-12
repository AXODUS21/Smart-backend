/**
 * Direct Resend email helper for server-side use
 * This bypasses the HTTP API route and directly uses Resend
 */

import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send credit purchase notification email directly
 */
export async function sendCreditPurchaseEmail(studentEmail, studentName, creditsPurchased, amount, paymentMethod) {
  console.log('[RESEND] sendCreditPurchaseEmail called with:', {
    studentEmail,
    studentName,
    creditsPurchased,
    amount,
    paymentMethod
  });
  
  try {
    // Check if Resend API key is configured
    console.log('[RESEND] Checking RESEND_API_KEY...');
    if (!process.env.RESEND_API_KEY) {
      console.error('[RESEND] ❌ RESEND_API_KEY is not configured');
      return { success: false, error: 'RESEND_API_KEY is not configured' };
    }
    console.log('[RESEND] ✅ RESEND_API_KEY found');

    // Get from email
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev';
    console.log('[RESEND] From email:', fromEmail);
    
    // Warn if using default test email
    if (fromEmail === 'onboarding@resend.dev') {
      console.warn('[RESEND] ⚠️ WARNING: Using default test email. Set RESEND_FROM_EMAIL to your verified domain email (e.g., noreply@yourdomain.com)');
      console.warn('[RESEND] ⚠️ With test email, you can only send to your own email address (1cursorfarm@gmail.com)');
    }

    // Get admin emails
    console.log('[RESEND] Fetching admin emails...');
    const { getUserEmailsByRole } = await import('./notifications');
    const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);
    console.log('[RESEND] Admin emails:', adminEmails);

    // Prepare email content
    const subject = 'Credits Purchased Successfully';
    const html = `
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
            <h2>Hello ${studentName}!</h2>
            <p>Your credit purchase was successful.</p>
            <div class="info-box">
              <p><strong>Credits Purchased:</strong> ${creditsPurchased}</p>
              <p><strong>Amount Paid:</strong> ${amount}</p>
              <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            </div>
            <p>Your credits have been added to your account and are ready to use.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Credits</a>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to student
    console.log('[RESEND] Sending email to student:', studentEmail);
    const studentResult = await resend.emails.send({
      from: fromEmail,
      to: studentEmail,
      subject: subject,
      html: html,
    });

    console.log('[RESEND] Student email result:', studentResult);

    if (studentResult.error) {
      console.error('[RESEND] ❌ Error sending email to student:', studentResult.error);
    } else {
      console.log('[RESEND] ✅ Credit purchase email sent to student:', studentEmail, 'ID:', studentResult.data?.id);
    }

    // Send to admins
    const adminResults = [];
    if (adminEmails && adminEmails.length > 0) {
      for (const adminEmail of adminEmails) {
        try {
          const adminResult = await resend.emails.send({
            from: fromEmail,
            to: adminEmail,
            subject: `Credit Purchase: ${studentName} - ${creditsPurchased} credits`,
            html: `
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
                    <h1>Credit Purchase Notification</h1>
                  </div>
                  <div class="content">
                    <p>A student has purchased credits:</p>
                    <div class="info-box">
                      <p><strong>Student:</strong> ${studentName}</p>
                      <p><strong>Email:</strong> ${studentEmail}</p>
                      <p><strong>Credits Purchased:</strong> ${creditsPurchased}</p>
                      <p><strong>Amount Paid:</strong> ${amount}</p>
                      <p><strong>Payment Method:</strong> ${paymentMethod}</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `,
          });

          if (adminResult.error) {
            console.error(`Error sending email to admin ${adminEmail}:`, adminResult.error);
            adminResults.push({ email: adminEmail, success: false, error: adminResult.error.message });
          } else {
            console.log('Credit purchase email sent to admin:', adminEmail, 'ID:', adminResult.data?.id);
            adminResults.push({ email: adminEmail, success: true, id: adminResult.data?.id });
          }
        } catch (err) {
          console.error(`Exception sending email to admin ${adminEmail}:`, err);
          adminResults.push({ email: adminEmail, success: false, error: err.message });
        }
      }
    }

    return {
      success: !studentResult.error,
      studentEmail: studentEmail,
      studentResult: studentResult.error ? { error: studentResult.error.message } : { id: studentResult.data?.id },
      adminResults: adminResults,
    };
  } catch (error) {
    console.error('Error in sendCreditPurchaseEmail:', error);
    return { success: false, error: error.message };
  }
}

