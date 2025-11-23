# Email Notifications Setup Guide

This document provides complete instructions for setting up email notifications using Email.js in the tutoring platform.

## Overview

The notification system uses Email.js to send automated emails for various events in the platform. Each notification type requires a corresponding Email.js template to be created in your Email.js dashboard.

## Environment Variables Required

Add these to your `.env.local` file:

```env
# Email.js Configuration
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key

# Email.js Template IDs (one for each notification type)
NEXT_PUBLIC_EMAILJS_TEMPLATE_SIGNUP=template_id_for_signup
NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPLICATION=template_id_for_tutor_application
NEXT_PUBLIC_EMAILJS_TEMPLATE_CREDIT_PURCHASE=template_id_for_credit_purchase
NEXT_PUBLIC_EMAILJS_TEMPLATE_LOW_CREDITS=template_id_for_low_credits
NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CREATED=template_id_for_booking_created
NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CANCELLED=template_id_for_booking_cancelled
NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_ACCEPTED=template_id_for_booking_accepted
NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_DECLINED=template_id_for_booking_declined
NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_REVIEW=template_id_for_tutor_review
NEXT_PUBLIC_EMAILJS_TEMPLATE_PAYROLL_CREDITED=template_id_for_payroll_credited
NEXT_PUBLIC_EMAILJS_TEMPLATE_ANNOUNCEMENT=template_id_for_announcement
NEXT_PUBLIC_EMAILJS_TEMPLATE_SESSION_LAPSE=template_id_for_session_lapse
NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPROVAL=template_id_for_tutor_approval
```

## Email.js Template Setup

### Step 1: Get Email.js Account
1. Sign up at [https://www.emailjs.com/](https://www.emailjs.com/)
2. Verify your email account
3. Go to your Email.js dashboard

### Step 2: Create Email Service
1. Navigate to **Email Services** in the dashboard
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions
5. Copy your **Service ID** and add it to `NEXT_PUBLIC_EMAILJS_SERVICE_ID`

### Step 3: Create Templates

For each notification type below, create a template in Email.js:

1. Go to **Email Templates** in the dashboard
2. Click **Create New Template**
3. Use the template variables provided below
4. Copy the **Template ID** and add it to the corresponding environment variable

---

## Template Details

### 1. Signup Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_SIGNUP`)

**Recipients:** Student/Tutor/Admin/SuperAdmin (the user who signed up)

**Template Variables:**
- `to_email` - User's email address
- `user_name` - User's full name (or email if name not available)
- `user_type` - User type (student/tutor/admin/superadmin)
- `first_name` - User's first name
- `last_name` - User's last name
- `user_email` - User's email address

**Sample Template:**
```
Subject: Welcome to {{user_type}}!

Hello {{first_name}},

Welcome to our tutoring platform! Your account has been successfully created.

Account Type: {{user_type}}
Email: {{user_email}}

Thank you for joining us!

Best regards,
The Tutoring Team
```

---

### 2. Tutor Application Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPLICATION`)

**Recipients:** Admin/SuperAdmin

**Template Variables:**
- `to_email` - Admin/SuperAdmin email address
- `tutor_name` - Tutor's full name
- `tutor_email` - Tutor's email address
- `application_id` - Application ID

**Sample Template:**
```
Subject: New Tutor Application Received

Hello Admin,

A new tutor application has been submitted:

Tutor Name: {{tutor_name}}
Tutor Email: {{tutor_email}}
Application ID: {{application_id}}

Please review the application in the admin dashboard.

Best regards,
The Tutoring Team
```

---

### 3. Credit Purchase Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_CREDIT_PURCHASE`)

**Recipients:** Student, Admin/SuperAdmin

**Template Variables:**
- `to_email` - Recipient email address
- `student_name` - Student's name
- `student_email` - Student's email (for admin notifications)
- `credits_purchased` - Number of credits purchased
- `amount` - Purchase amount
- `currency` - Currency (USD/PHP)
- `purchase_date` - Date of purchase

**Sample Template:**
```
Subject: Credit Purchase Confirmation

Hello {{student_name}},

Your credit purchase has been confirmed:

Credits Purchased: {{credits_purchased}}
Amount: {{currency}} {{amount}}
Date: {{purchase_date}}

Your credits have been added to your account. Thank you for your purchase!

Best regards,
The Tutoring Team
```

---

### 4. Low Credits Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_LOW_CREDITS`)

**Recipients:** Student

**Template Variables:**
- `to_email` - Student email address
- `student_name` - Student's name
- `current_credits` - Current credit balance
- `warning_level` - Warning level ('critical' for 1 credit, 'low' for others)

**Sample Template:**
```
Subject: Low Credits Alert

Hello {{student_name}},

Your account balance is running low:

Current Credits: {{current_credits}}

{% if warning_level == 'critical' %}
⚠️ WARNING: You have only 1 credit remaining! Please purchase more credits to continue booking sessions.
{% else %}
Please consider purchasing more credits to avoid interruption of your tutoring sessions.
{% endif %}

Thank you,
The Tutoring Team
```

---

### 5. Booking Created Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CREATED`)

**Recipients:** Tutor, Admin/SuperAdmin

**Template Variables:**
- `to_email` - Recipient email address
- `tutor_name` - Tutor's name
- `tutor_email` - Tutor's email
- `student_name` - Student's name
- `student_email` - Student's email
- `subject` - Subject of the session
- `session_date` - Session date and time
- `duration` - Session duration (e.g., "60 minutes")
- `credits` - Credits required for the session
- `action_type` - Action type ("created")

**Sample Template:**
```
Subject: New Booking Request Received

Hello {{tutor_name}},

You have received a new booking request:

Student: {{student_name}} ({{student_email}})
Subject: {{subject}}
Date & Time: {{session_date}}
Duration: {{duration}}
Credits: {{credits}}

Please accept or decline this booking request in your dashboard.

Best regards,
The Tutoring Team
```

---

### 6. Booking Cancelled Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_CANCELLED`)

**Recipients:** Tutor, Admin/SuperAdmin

**Template Variables:**
- `to_email` - Recipient email address
- `tutor_name` - Tutor's name
- `tutor_email` - Tutor's email
- `student_name` - Student's name
- `student_email` - Student's email
- `subject` - Subject of the session
- `session_date` - Session date and time
- `duration` - Session duration
- `credits` - Credits that will be refunded
- `cancellation_reason` - Reason for cancellation
- `action_type` - Action type ("cancelled")

**Sample Template:**
```
Subject: Session Cancelled

Hello {{tutor_name}},

A booking has been cancelled:

Student: {{student_name}} ({{student_email}})
Subject: {{subject}}
Date & Time: {{session_date}}
Duration: {{duration}}
Credits: {{credits}} (refunded to student)
Reason: {{cancellation_reason}}

Best regards,
The Tutoring Team
```

---

### 7. Booking Accepted Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_ACCEPTED`)

**Recipients:** Student, Admin/SuperAdmin

**Template Variables:**
- `to_email` - Recipient email address
- `student_name` - Student's name
- `student_email` - Student's email (for admin notifications)
- `tutor_name` - Tutor's name
- `tutor_email` - Tutor's email
- `subject` - Subject of the session
- `session_date` - Session date and time
- `duration` - Session duration
- `credits` - Credits required
- `meeting_link` - Meeting link (Zoom, Google Meet, etc.)
- `action_type` - Action type ("accepted")

**Sample Template:**
```
Subject: Your Booking Has Been Accepted! 🎉

Hello {{student_name}},

Great news! Your booking request has been accepted by {{tutor_name}}.

Session Details:
Subject: {{subject}}
Date & Time: {{session_date}}
Duration: {{duration}}
Credits: {{credits}}
Tutor: {{tutor_name}}

Meeting Link: {{meeting_link}}

Please mark this date in your calendar. We look forward to your session!

Best regards,
The Tutoring Team
```

---

### 8. Booking Declined Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_BOOKING_DECLINED`)

**Recipients:** Student, Admin/SuperAdmin

**Template Variables:**
- `to_email` - Recipient email address
- `student_name` - Student's name
- `student_email` - Student's email (for admin notifications)
- `tutor_name` - Tutor's name
- `tutor_email` - Tutor's email
- `subject` - Subject of the session
- `session_date` - Session date and time
- `duration` - Session duration
- `credits` - Credits that will be refunded
- `meeting_link` - Empty for declined bookings
- `action_type` - Action type ("declined")

**Sample Template:**
```
Subject: Booking Request Declined

Hello {{student_name}},

Unfortunately, your booking request has been declined by {{tutor_name}}.

Session Details:
Subject: {{subject}}
Date & Time: {{session_date}}
Duration: {{duration}}
Credits: {{credits}} (refunded to your account)

The credits have been refunded to your account. You can book a session with another tutor.

Thank you for your understanding.

Best regards,
The Tutoring Team
```

---

### 9. Tutor Review Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_REVIEW`)

**Recipients:** Student

**Template Variables:**
- `to_email` - Student email address
- `student_name` - Student's name
- `tutor_name` - Tutor's name
- `subject` - Subject of the session
- `session_date` - Session date
- `review_text` - Review content written by tutor

**Sample Template:**
```
Subject: Feedback from {{tutor_name}}

Hello {{student_name}},

You have received feedback from {{tutor_name}} for your session:

Session Details:
Subject: {{subject}}
Date: {{session_date}}

Feedback:
{{review_text}}

Thank you for using our platform!

Best regards,
The Tutoring Team
```

---

### 10. Payroll Credited Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_PAYROLL_CREDITED`)

**Recipients:** Tutor, Admin/SuperAdmin

**Template Variables:**
- `to_email` - Recipient email address
- `tutor_name` - Tutor's name
- `tutor_email` - Tutor's email (for admin notifications)
- `amount` - Amount credited
- `currency` - Currency (USD/PHP)
- `payroll_period` - Payroll period (e.g., "January 2024")
- `credit_date` - Date when credits were processed

**Sample Template:**
```
Subject: Payroll Credited - {{currency}} {{amount}}

Hello {{tutor_name}},

Your payroll has been credited:

Amount: {{currency}} {{amount}}
Period: {{payroll_period}}
Date: {{credit_date}}

The amount has been processed and should appear in your account shortly.

Thank you for your service!

Best regards,
The Tutoring Team
```

---

### 11. Announcement Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_ANNOUNCEMENT`)

**Recipients:** Student/Tutor/Admin/SuperAdmin (based on target audience)

**Template Variables:**
- `to_email` - Recipient email address
- `announcement_title` - Announcement title
- `announcement_message` - Announcement content
- `priority` - Priority level (normal/high/urgent)
- `announcement_date` - Date of announcement

**Sample Template:**
```
Subject: {% if priority == 'urgent' %}URGENT: {% elif priority == 'high' %}IMPORTANT: {% endif %}{{announcement_title}}

Hello,

{% if priority == 'urgent' %}
🔴 URGENT ANNOUNCEMENT
{% elif priority == 'high' %}
⚠️ IMPORTANT ANNOUNCEMENT
{% else %}
📢 Announcement
{% endif %}

{{announcement_title}}

{{announcement_message}}

Date: {{announcement_date}}

Thank you,
The Tutoring Team
```

---

### 12. Session Lapse Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_SESSION_LAPSE`)

**Recipients:** Student, Tutor, Admin/SuperAdmin

**Template Variables:**
- `to_email` - Recipient email address
- `student_name` - Student's name
- `student_email` - Student's email (for tutor/admin notifications)
- `tutor_name` - Tutor's name
- `tutor_email` - Tutor's email (for student/admin notifications)
- `subject` - Subject of the session
- `session_date` - Session date and time
- `lapse_reason` - Reason for lapse (tutor_no_response/student_no_response)

**Sample Template:**
```
Subject: Session Lapsed - Action Required

Hello,

A scheduled session has lapsed without response:

Session Details:
Subject: {{subject}}
Date & Time: {{session_date}}
Student: {{student_name}} ({{student_email}})
Tutor: {{tutor_name}} ({{tutor_email}})

Reason: 
{% if lapse_reason == 'tutor_no_response' %}
Tutor did not respond to the booking request in time.
{% else %}
Student did not respond or confirm the session.
{% endif %}

The session has been cancelled and credits have been refunded (if applicable).

Please contact support if you have any questions.

Best regards,
The Tutoring Team
```

---

### 13. Tutor Approval Notification (`NEXT_PUBLIC_EMAILJS_TEMPLATE_TUTOR_APPROVAL`)

**Recipients:** Tutor

**Template Variables:**
- `to_email` - Tutor email address
- `tutor_name` - Tutor's name
- `approval_status` - Approval status ("approved" or "rejected")
- `approval_notes` - Notes from admin (optional)
- `approval_date` - Date of approval/rejection

**Sample Template:**
```
Subject: Tutor Application {{approval_status|upper}}

Hello {{tutor_name}},

Your tutor application has been {{approval_status}}.

{% if approval_status == 'approved' %}
🎉 Congratulations! Your application has been approved.

You can now:
- Set up your profile
- Add your availability
- Start accepting bookings from students

{% else %}
We're sorry to inform you that your application was not approved at this time.

{% endif %}

{% if approval_notes %}
Additional Notes:
{{approval_notes}}
{% endif %}

Date: {{approval_date}}

{% if approval_status == 'approved' %}
Welcome to our tutoring platform!
{% endif %}

Best regards,
The Tutoring Team
```

---

## Integration Points

The notification functions are automatically called from the following locations:

1. **Signup**: `app/login/page.js` - After user signs up
2. **Tutor Application**: `components/dashboard/TutorApplication.js` - After tutor submits application
3. **Credit Purchase**: `app/api/payments/stripe/success/route.js` and `app/api/payments/paymongo/success/route.js` - After successful payment
4. **Low Credits**: Checked when credits are used or when viewing credits page
5. **Booking Created/Cancelled**: `components/dashboard/BookSession.js` and `components/dashboard/SessionManagement.js`
6. **Session Response**: `components/dashboard/Meetings.js` - When tutor accepts/declines
7. **Tutor Review**: `components/dashboard/PastSessions.js` - When tutor writes review
8. **Payroll**: To be implemented in payroll processing
9. **Announcement**: `components/dashboard/AdminAnnouncements.js` - When announcement is created
10. **Session Lapse**: Checked periodically for expired sessions
11. **Tutor Approval**: `components/dashboard/AdminTutorApplications.js` - When admin approves/rejects

---

## Testing

After setting up templates:

1. Restart your Next.js development server
2. Test each notification type by triggering the corresponding action
3. Check Email.js dashboard for delivery status
4. Verify email content matches template variables

---

## Troubleshooting

### Emails not sending
- Check that all environment variables are set correctly
- Verify Email.js service and templates are active
- Check browser console for errors
- Verify Email.js public key is correct

### Template variables not working
- Ensure variable names match exactly (case-sensitive)
- Check that variables are wrapped in `{{}}` in Email.js templates
- Verify template ID is correct in environment variable

### Missing recipients
- For admin notifications, ensure admin/superadmin records have email addresses
- Check Supabase database for email field values
- Verify user role is correctly identified

---

## Notes

- Email.js has a free tier with monthly limits
- Consider upgrading if you expect high email volume
- All email sending is asynchronous and won't block user actions
- Failed email sends are logged to console but won't cause errors in the application

