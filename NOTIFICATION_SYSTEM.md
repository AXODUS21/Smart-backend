# Notification System Documentation

This document describes the notification system implemented using Resend for sending email notifications.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Resend API Configuration (Required)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional: App name for email templates
APP_NAME=Smart Tutoring Platform

# Optional: Base URL for email links (defaults to http://localhost:3000)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Getting Your Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Create an API key in the dashboard
3. Add it to your `.env.local` file as `RESEND_API_KEY`

### Setting Up Your From Email

1. In Resend dashboard, verify your domain or use the default `onboarding@resend.dev` for testing
2. Set `RESEND_FROM_EMAIL` to your verified email address
3. If not set, the system will default to `onboarding@resend.dev`

## Notification Types

The system supports 11 different notification types:

### 1. Signup Notification
**Recipients:** The user who signed up (student/tutor/admin/superadmin)

**Usage:**
```javascript
import { notifySignup } from '@/lib/notificationService';

await notifySignup(
  userEmail,      // string: User's email
  userType,       // string: 'student', 'tutor', 'admin', or 'superadmin'
  firstName,      // string: User's first name
  lastName        // string: User's last name
);
```

**Email Template Variables:**
- `userEmail` - User's email address
- `userType` - Type of user (student/tutor/admin/superadmin)
- `firstName` - User's first name
- `lastName` - User's last name

---

### 2. Tutor Application Notification
**Recipients:** Admin and Superadmin

**Usage:**
```javascript
import { notifyTutorApplication } from '@/lib/notificationService';

await notifyTutorApplication(
  tutorName,      // string: Tutor's full name
  tutorEmail,     // string: Tutor's email
  applicationId   // string/number: Application ID
);
```

**Email Template Variables:**
- `tutorName` - Tutor's full name
- `tutorEmail` - Tutor's email address
- `applicationId` - Application ID

---

### 3. Credit Purchase Notification
**Recipients:** Student, Admin, and Superadmin

**Usage:**
```javascript
import { notifyCreditPurchase } from '@/lib/notificationService';

await notifyCreditPurchase(
  studentEmail,     // string: Student's email
  studentName,      // string: Student's name
  creditsPurchased, // number: Number of credits purchased
  amount,           // string: Amount paid (e.g., "$50.00")
  paymentMethod     // string: Payment method (e.g., "Stripe", "PayMongo")
);
```

**Email Template Variables:**
- `studentEmail` - Student's email address
- `studentName` - Student's name
- `creditsPurchased` - Number of credits purchased
- `amount` - Amount paid
- `paymentMethod` - Payment method used

---

### 4. Low Credits Warning
**Recipients:** Student

**Usage:**
```javascript
import { notifyLowCredits } from '@/lib/notificationService';

await notifyLowCredits(
  studentEmail,    // string: Student's email
  studentName,     // string: Student's name
  remainingCredits // number: Number of credits remaining
);
```

**Email Template Variables:**
- `studentEmail` - Student's email address
- `studentName` - Student's name
- `remainingCredits` - Number of credits remaining

---

### 5. Session Booking/Cancellation
**Recipients:** Tutor, Admin, and Superadmin

**Usage:**
```javascript
import { notifySessionBooking } from '@/lib/notificationService';

await notifySessionBooking(
  studentEmail,  // string: Student's email
  studentName,   // string: Student's name
  tutorEmail,    // string: Tutor's email
  tutorName,     // string: Tutor's name
  sessionDate,   // string: Session date (formatted)
  sessionTime,   // string: Session time (formatted)
  subject,       // string: Subject name
  action         // string: 'booked' or 'cancelled'
);
```

**Email Template Variables:**
- `studentEmail` - Student's email address
- `studentName` - Student's name
- `tutorEmail` - Tutor's email address
- `tutorName` - Tutor's name
- `sessionDate` - Session date
- `sessionTime` - Session time
- `subject` - Subject name
- `action` - Action taken: 'booked' or 'cancelled'

---

### 6. Session Response (Accept/Decline)
**Recipients:** Student, Admin, and Superadmin

**Usage:**
```javascript
import { notifySessionResponse } from '@/lib/notificationService';

await notifySessionResponse(
  tutorEmail,    // string: Tutor's email
  tutorName,     // string: Tutor's name
  studentEmail,  // string: Student's email
  studentName,   // string: Student's name
  sessionDate,   // string: Session date (formatted)
  sessionTime,   // string: Session time (formatted)
  subject,       // string: Subject name
  action         // string: 'accepted' or 'declined'
);
```

**Email Template Variables:**
- `tutorEmail` - Tutor's email address
- `tutorName` - Tutor's name
- `studentEmail` - Student's email address
- `studentName` - Student's name
- `sessionDate` - Session date
- `sessionTime` - Session time
- `subject` - Subject name
- `action` - Action taken: 'accepted' or 'declined'

---

### 7. Tutor Review
**Recipients:** Student

**Usage:**
```javascript
import { notifyTutorReview } from '@/lib/notificationService';

await notifyTutorReview(
  tutorName,     // string: Tutor's name
  studentEmail,  // string: Student's email
  studentName,   // string: Student's name
  sessionDate,   // string: Session date (formatted)
  subject,       // string: Subject name
  rating,        // number: Rating (1-5)
  review         // string: Review text (optional)
);
```

**Email Template Variables:**
- `tutorName` - Tutor's name
- `studentEmail` - Student's email address
- `studentName` - Student's name
- `sessionDate` - Session date
- `subject` - Subject name
- `rating` - Rating (1-5)
- `review` - Review text (optional)

---

### 8. Payroll Credited
**Recipients:** Tutor, Admin, and Superadmin

**Usage:**
```javascript
import { notifyPayrollCredited } from '@/lib/notificationService';

await notifyPayrollCredited(
  tutorEmail,  // string: Tutor's email
  tutorName,   // string: Tutor's name
  amount,      // string: Amount credited (e.g., "$500.00")
  period       // string: Payroll period (e.g., "January 2024")
);
```

**Email Template Variables:**
- `tutorEmail` - Tutor's email address
- `tutorName` - Tutor's name
- `amount` - Amount credited
- `period` - Payroll period

---

### 9. Announcement
**Recipients:** All users or specific roles (student/tutor/admin/superadmin)

**Usage:**
```javascript
import { notifyAnnouncement } from '@/lib/notificationService';

// Send to all users
await notifyAnnouncement(
  announcementTitle,    // string: Announcement title
  announcementContent,  // string: Announcement content (supports newlines)
  ['student', 'tutor', 'admin', 'superadmin'] // array: Roles to notify
);

// Send to specific roles only
await notifyAnnouncement(
  announcementTitle,
  announcementContent,
  ['student', 'tutor'] // Only students and tutors
);
```

**Email Template Variables:**
- `announcementTitle` - Announcement title
- `announcementContent` - Announcement content (supports newlines)

---

### 10. Session Lapse
**Recipients:** Student, Tutor, Admin, and Superadmin

**Usage:**
```javascript
import { notifySessionLapse } from '@/lib/notificationService';

await notifySessionLapse(
  studentEmail,  // string: Student's email
  studentName,   // string: Student's name
  tutorEmail,    // string: Tutor's email
  tutorName,     // string: Tutor's name
  sessionDate,   // string: Session date (formatted)
  sessionTime,   // string: Session time (formatted)
  subject,       // string: Subject name
  lapsedBy       // string: 'student' or 'tutor'
);
```

**Email Template Variables:**
- `studentEmail` - Student's email address
- `studentName` - Student's name
- `tutorEmail` - Tutor's email address
- `tutorName` - Tutor's name
- `sessionDate` - Session date
- `sessionTime` - Session time
- `subject` - Subject name
- `lapsedBy` - Who didn't respond: 'student' or 'tutor'

---

### 11. Tutor Application Approval
**Recipients:** Tutor

**Usage:**
```javascript
import { notifyTutorApplicationApproval } from '@/lib/notificationService';

await notifyTutorApplicationApproval(
  tutorEmail,    // string: Tutor's email
  tutorName,     // string: Tutor's name
  applicationId, // string/number: Application ID
  status         // string: 'approved' or 'rejected'
);
```

**Email Template Variables:**
- `tutorEmail` - Tutor's email address
- `tutorName` - Tutor's name
- `applicationId` - Application ID
- `status` - Application status: 'approved' or 'rejected'

---

## Helper Functions

The system includes helper functions to fetch user emails by role:

```javascript
import {
  getUserEmailsByRole,
  getUserEmailById,
  getUserEmailsByIds,
  getStudentEmailById,
  getTutorEmailById,
} from '@/lib/notifications';

// Get all emails for specific roles
const adminEmails = await getUserEmailsByRole(['admin', 'superadmin']);

// Get email for a specific user
const userEmail = await getUserEmailById(userId, 'student');

// Get emails for multiple users
const emails = await getUserEmailsByIds([userId1, userId2], 'tutor');

// Get student email by student ID (not user_id)
const studentEmail = await getStudentEmailById(studentId);

// Get tutor email by tutor ID (not user_id)
const tutorEmail = await getTutorEmailById(tutorId);
```

## Integration Examples

### Example 1: Notify on User Signup

```javascript
// In your signup handler
import { notifySignup } from '@/lib/notificationService';

const { data: authData } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      first_name: firstName,
      last_name: lastName,
      user_type: userType,
    },
  },
});

if (authData.user) {
  // Send notification
  try {
    await notifySignup(
      email,
      userType,
      firstName,
      lastName
    );
  } catch (error) {
    console.error('Failed to send signup notification:', error);
    // Don't fail signup if notification fails
  }
}
```

### Example 2: Notify on Credit Purchase

```javascript
// In your payment success handler
import { notifyCreditPurchase } from '@/lib/notificationService';

// After successful payment
await notifyCreditPurchase(
  studentEmail,
  studentName,
  creditsPurchased,
  `$${amount.toFixed(2)}`,
  'Stripe'
);
```

### Example 3: Notify on Session Booking

```javascript
// In your booking handler
import { notifySessionBooking } from '@/lib/notificationService';
import { getTutorEmailById, getStudentEmailById } from '@/lib/notifications';

// After creating booking
const tutorEmail = await getTutorEmailById(tutorId);
const studentEmail = await getStudentEmailById(studentId);

await notifySessionBooking(
  studentEmail,
  `${student.first_name} ${student.last_name}`,
  tutorEmail,
  `${tutor.first_name} ${tutor.last_name}`,
  new Date(session.start_time_utc).toLocaleDateString(),
  new Date(session.start_time_utc).toLocaleTimeString(),
  session.subject,
  'booked'
);
```

## Error Handling

All notification functions return a promise. It's recommended to handle errors gracefully:

```javascript
try {
  await notifySignup(email, userType, firstName, lastName);
} catch (error) {
  console.error('Notification failed:', error);
  // Don't fail the main operation if notification fails
}
```

## Testing

To test notifications:

1. Set up your Resend API key in `.env.local`
2. Use the test email addresses provided by Resend
3. Check the Resend dashboard for delivery status
4. Monitor console logs for any errors

## Troubleshooting

### Emails not sending
- Check that `RESEND_API_KEY` is set correctly
- Verify your domain/email is verified in Resend
- Check the Resend dashboard for error messages
- Review server logs for API errors

### Missing recipients
- Ensure user emails exist in the database
- Check that role names match exactly: 'student', 'tutor', 'admin', 'superadmin'
- Verify table names match your database schema

### Template errors
- Ensure all required template variables are provided
- Check that data types match expected formats
- Review the API route logs for template rendering errors

## Customization

To customize email templates, edit the `EMAIL_TEMPLATES` object in:
`app/api/notifications/send/route.js`

Each template has:
- `subject`: Function that generates the email subject
- `html`: Function that generates the HTML email body

You can modify the HTML/CSS to match your brand.


