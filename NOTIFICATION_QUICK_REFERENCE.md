# Notification System - Quick Reference

## Environment Variables Required

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## All 11 Notification Functions

### 1. Signup
```javascript
import { notifySignup } from '@/lib/notificationService';
await notifySignup(userEmail, userType, firstName, lastName);
// Recipients: user who signed up
```

### 2. Tutor Application
```javascript
import { notifyTutorApplication } from '@/lib/notificationService';
await notifyTutorApplication(tutorName, tutorEmail, applicationId);
// Recipients: admin, superadmin
```

### 3. Credit Purchase
```javascript
import { notifyCreditPurchase } from '@/lib/notificationService';
await notifyCreditPurchase(studentEmail, studentName, creditsPurchased, amount, paymentMethod);
// Recipients: student, admin, superadmin
```

### 4. Low Credits
```javascript
import { notifyLowCredits } from '@/lib/notificationService';
await notifyLowCredits(studentEmail, studentName, remainingCredits);
// Recipients: student
```

### 5. Session Booking/Cancellation
```javascript
import { notifySessionBooking } from '@/lib/notificationService';
await notifySessionBooking(studentEmail, studentName, tutorEmail, tutorName, sessionDate, sessionTime, subject, action);
// Recipients: tutor, admin, superadmin
// action: 'booked' or 'cancelled'
```

### 6. Session Response (Accept/Decline)
```javascript
import { notifySessionResponse } from '@/lib/notificationService';
await notifySessionResponse(tutorEmail, tutorName, studentEmail, studentName, sessionDate, sessionTime, subject, action);
// Recipients: student, admin, superadmin
// action: 'accepted' or 'declined'
```

### 7. Tutor Review
```javascript
import { notifyTutorReview } from '@/lib/notificationService';
await notifyTutorReview(tutorName, studentEmail, studentName, sessionDate, subject, rating, review);
// Recipients: student
```

### 8. Payroll Credited
```javascript
import { notifyPayrollCredited } from '@/lib/notificationService';
await notifyPayrollCredited(tutorEmail, tutorName, amount, period);
// Recipients: tutor, admin, superadmin
```

### 9. Announcement
```javascript
import { notifyAnnouncement } from '@/lib/notificationService';
await notifyAnnouncement(announcementTitle, announcementContent, roles);
// Recipients: student, tutor, admin, superadmin (or specific roles)
// roles: ['student', 'tutor', 'admin', 'superadmin'] (default: all)
```

### 10. Session Lapse
```javascript
import { notifySessionLapse } from '@/lib/notificationService';
await notifySessionLapse(studentEmail, studentName, tutorEmail, tutorName, sessionDate, sessionTime, subject, lapsedBy);
// Recipients: student, tutor, admin, superadmin
// lapsedBy: 'student' or 'tutor'
```

### 11. Tutor Application Approval
```javascript
import { notifyTutorApplicationApproval } from '@/lib/notificationService';
await notifyTutorApplicationApproval(tutorEmail, tutorName, applicationId, status);
// Recipients: tutor
// status: 'approved' or 'rejected'
```

## Helper Functions

```javascript
import {
  getUserEmailsByRole,
  getUserEmailById,
  getUserEmailsByIds,
  getStudentEmailById,
  getTutorEmailById,
} from '@/lib/notifications';

// Get emails by role
const emails = await getUserEmailsByRole(['admin', 'superadmin']);

// Get single user email
const email = await getUserEmailById(userId, 'student');

// Get multiple user emails
const emails = await getUserEmailsByIds([id1, id2], 'tutor');

// Get student/tutor email by table ID
const email = await getStudentEmailById(studentId);
const email = await getTutorEmailById(tutorId);
```

## Email Template Variables Reference

Each notification type uses specific variables. See `NOTIFICATION_SYSTEM.md` for detailed variable lists.

## Files Created

- `lib/notifications.js` - Helper functions to get user emails
- `lib/notificationService.js` - All 11 notification functions
- `app/api/notifications/send/route.js` - API route for sending emails
- `NOTIFICATION_SYSTEM.md` - Full documentation
- `NOTIFICATION_QUICK_REFERENCE.md` - This file

