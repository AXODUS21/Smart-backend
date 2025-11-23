# Notification System - Environment Variables & Template Variables

## Environment Variables Required

These must be set in your `.env.local` file:

### Required
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
- **Description:** Your Resend API key
- **Where to get:** https://resend.com dashboard
- **Used in:** `app/api/notifications/send/route.js`

### Optional (with defaults)
```env
RESEND_FROM_EMAIL=noreply@yourdomain.com
```
- **Description:** Email address to send from
- **Default:** `onboarding@resend.dev` (for testing)
- **Used in:** `app/api/notifications/send/route.js`

```env
APP_NAME=Smart Tutoring Platform
```
- **Description:** Application name for email templates
- **Default:** `Smart Tutoring Platform`
- **Used in:** Email templates (signup notification)

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```
- **Description:** Base URL for email links
- **Default:** `http://localhost:3000`
- **Used in:** All email templates (for button links)

---

## Email Template Variables

Each notification type requires specific variables. These are passed when calling the notification functions.

### 1. Signup Notification
**Function:** `notifySignup(userEmail, userType, firstName, lastName)`

**Template Variables:**
- `userEmail` (string) - User's email address
- `userType` (string) - 'student', 'tutor', 'admin', or 'superadmin'
- `firstName` (string) - User's first name
- `lastName` (string) - User's last name

**Env Variables Used:**
- `APP_NAME` - For welcome message
- `NEXT_PUBLIC_BASE_URL` - For "Get Started" button link

---

### 2. Tutor Application Notification
**Function:** `notifyTutorApplication(tutorName, tutorEmail, applicationId)`

**Template Variables:**
- `tutorName` (string) - Tutor's full name
- `tutorEmail` (string) - Tutor's email address
- `applicationId` (string/number) - Application ID

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "Review Application" button link

---

### 3. Credit Purchase Notification
**Function:** `notifyCreditPurchase(studentEmail, studentName, creditsPurchased, amount, paymentMethod)`

**Template Variables:**
- `studentEmail` (string) - Student's email address
- `studentName` (string) - Student's name
- `creditsPurchased` (number) - Number of credits purchased
- `amount` (string) - Amount paid (e.g., "$50.00")
- `paymentMethod` (string) - Payment method (e.g., "Stripe", "PayMongo")

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "View Credits" button link

---

### 4. Low Credits Warning
**Function:** `notifyLowCredits(studentEmail, studentName, remainingCredits)`

**Template Variables:**
- `studentEmail` (string) - Student's email address
- `studentName` (string) - Student's name
- `remainingCredits` (number) - Number of credits remaining

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "Purchase Credits" button link

---

### 5. Session Booking/Cancellation
**Function:** `notifySessionBooking(studentEmail, studentName, tutorEmail, tutorName, sessionDate, sessionTime, subject, action)`

**Template Variables:**
- `studentEmail` (string) - Student's email address
- `studentName` (string) - Student's name
- `tutorEmail` (string) - Tutor's email address
- `tutorName` (string) - Tutor's name
- `sessionDate` (string) - Session date (formatted, e.g., "January 15, 2024")
- `sessionTime` (string) - Session time (formatted, e.g., "2:00 PM")
- `subject` (string) - Subject name
- `action` (string) - 'booked' or 'cancelled'

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "View Session" button link

---

### 6. Session Response (Accept/Decline)
**Function:** `notifySessionResponse(tutorEmail, tutorName, studentEmail, studentName, sessionDate, sessionTime, subject, action)`

**Template Variables:**
- `tutorEmail` (string) - Tutor's email address
- `tutorName` (string) - Tutor's name
- `studentEmail` (string) - Student's email address
- `studentName` (string) - Student's name
- `sessionDate` (string) - Session date (formatted)
- `sessionTime` (string) - Session time (formatted)
- `subject` (string) - Subject name
- `action` (string) - 'accepted' or 'declined'

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "View Session" button link

---

### 7. Tutor Review
**Function:** `notifyTutorReview(tutorName, studentEmail, studentName, sessionDate, subject, rating, review)`

**Template Variables:**
- `tutorName` (string) - Tutor's name
- `studentEmail` (string) - Student's email address
- `studentName` (string) - Student's name
- `sessionDate` (string) - Session date (formatted)
- `subject` (string) - Subject name
- `rating` (number) - Rating (1-5)
- `review` (string) - Review text (optional)

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "View Review" button link

---

### 8. Payroll Credited
**Function:** `notifyPayrollCredited(tutorEmail, tutorName, amount, period)`

**Template Variables:**
- `tutorEmail` (string) - Tutor's email address
- `tutorName` (string) - Tutor's name
- `amount` (string) - Amount credited (e.g., "$500.00")
- `period` (string) - Payroll period (e.g., "January 2024")

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "View Payroll" button link

---

### 9. Announcement
**Function:** `notifyAnnouncement(announcementTitle, announcementContent, roles)`

**Template Variables:**
- `announcementTitle` (string) - Announcement title
- `announcementContent` (string) - Announcement content (supports newlines with `\n`)

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "View Platform" button link

---

### 10. Session Lapse
**Function:** `notifySessionLapse(studentEmail, studentName, tutorEmail, tutorName, sessionDate, sessionTime, subject, lapsedBy)`

**Template Variables:**
- `studentEmail` (string) - Student's email address
- `studentName` (string) - Student's name
- `tutorEmail` (string) - Tutor's email address
- `tutorName` (string) - Tutor's name
- `sessionDate` (string) - Session date (formatted)
- `sessionTime` (string) - Session time (formatted)
- `subject` (string) - Subject name
- `lapsedBy` (string) - 'student' or 'tutor'

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "View Session" button link

---

### 11. Tutor Application Approval
**Function:** `notifyTutorApplicationApproval(tutorEmail, tutorName, applicationId, status)`

**Template Variables:**
- `tutorEmail` (string) - Tutor's email address
- `tutorName` (string) - Tutor's name
- `applicationId` (string/number) - Application ID
- `status` (string) - 'approved' or 'rejected'

**Env Variables Used:**
- `NEXT_PUBLIC_BASE_URL` - For "Get Started" or "Contact Support" button link

---

## Summary

### Environment Variables Summary
1. `RESEND_API_KEY` - **REQUIRED** - Your Resend API key
2. `RESEND_FROM_EMAIL` - Optional - Email to send from (defaults to `onboarding@resend.dev`)
3. `APP_NAME` - Optional - App name (defaults to "Smart Tutoring Platform")
4. `NEXT_PUBLIC_BASE_URL` - Optional - Base URL for links (defaults to `http://localhost:3000`)

### Template Variables Summary
All notification functions require specific data variables. See the detailed list above for each notification type.

**Common patterns:**
- User information: `email`, `name`, `firstName`, `lastName`
- Session information: `sessionDate`, `sessionTime`, `subject`
- Action/Status: `action`, `status`, `lapsedBy`
- Financial: `amount`, `creditsPurchased`, `remainingCredits`
- IDs: `applicationId`, `studentId`, `tutorId`

---

## Quick Setup Checklist

1. ✅ Get Resend API key from https://resend.com
2. ✅ Add `RESEND_API_KEY` to `.env.local`
3. ✅ (Optional) Set `RESEND_FROM_EMAIL` if you have a verified domain
4. ✅ (Optional) Set `APP_NAME` for custom branding
5. ✅ (Optional) Set `NEXT_PUBLIC_BASE_URL` for production
6. ✅ Restart your dev server after adding environment variables

---

## Files Using These Variables

- **Environment Variables:** `app/api/notifications/send/route.js`
- **Template Variables:** All notification functions in `lib/notificationService.js`
- **Email Templates:** `app/api/notifications/send/route.js` (EMAIL_TEMPLATES object)

