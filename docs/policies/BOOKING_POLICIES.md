# Booking Policies Implementation Guide

This document outlines all the booking and session management policies implemented in the Smart Tutoring Platform.

## Overview

The platform enforces several key policies to ensure fair and reliable tutoring sessions:

1. **Advance Booking Requirement** - Sessions must be booked at least 2 hours in advance
2. **Cancellation Policy** - Cancellations with 24+ hours notice receive full credit refunds
3. **Rescheduling Policy** - Sessions can be rescheduled with 24+ hours notice
4. **No-Show Policy** - Credits are forfeited for student no-shows; refunded for tutor no-shows
5. **Daily Session Limits** - Maximum sessions per day to prevent tutor burnout

---

## 1. Advance Booking Requirement

### Policy Details
- Students must book sessions **at least 2 hours in advance**
- This is configurable via the `PlatformSettings` table
- Setting key: `min_booking_hours_advance` (default: 2)

### Implementation
- **File**: `components/dashboard/BookSession.js`
- **Function**: `getAvailableDates()`
- The date selection filters out dates that don't meet the minimum advance booking requirement
- Users cannot select dates/times that are within the 2-hour window

### Database
- Configuration stored in `PlatformSettings` table
- Column: `setting_key = 'min_booking_hours_advance'`

---

## 2. Cancellation Policy

### Policy Details
- **Full Refund**: Cancellations made **24+ hours before** the session start time
- **No Refund**: Cancellations made **less than 24 hours** before the session
- Credits are automatically refunded to the student's account
- Cancellation reason is recorded for analytics

### Implementation
- **File**: `components/dashboard/SessionManagement.js`
- **Function**: `handleCancellation()`
- **Validation**: `canCancelSession(session)`

### User Flow
1. Student navigates to "Manage Sessions" tab
2. Clicks "Cancel" button on an upcoming session
3. Modal appears showing:
   - Session details
   - Full credit refund amount
   - Cancellation reason input
4. Upon confirmation:
   - Session status changes to "cancelled"
   - Credits are refunded to student account
   - Cancellation timestamp and reason are recorded

### Database Changes
- `Schedules` table columns:
  - `cancellation_requested_at`: Timestamp when cancellation was requested
  - `cancellation_reason`: Text reason provided by student
  - `cancellation_status`: 'none', 'pending', 'approved', or 'rejected'
  - `credits_refunded`: Amount of credits refunded

---

## 3. Rescheduling Policy

### Policy Details
- **Allowed**: Rescheduling with **24+ hours notice**
- **Not Allowed**: Rescheduling within 24 hours of session start
- Credits are automatically adjusted for the new session time
- Original session is marked as "rescheduled"

### Implementation
- **File**: `components/dashboard/SessionManagement.js`
- **Function**: `handleRescheduling()`
- **Validation**: `canRescheduleSession(session)`

### User Flow
1. Student navigates to "Manage Sessions" tab
2. Clicks "Reschedule" button on an upcoming session
3. Modal appears with:
   - Current session details
   - New date input
   - New time input
4. Upon confirmation:
   - New session is created with same credits and duration
   - Original session is marked as "rescheduled"
   - Rescheduling timestamp is recorded

### Database Changes
- `Schedules` table columns:
  - `rescheduled_from_id`: Foreign key to original session
  - `rescheduled_at`: Timestamp when rescheduling occurred

---

## 4. No-Show Policy

### Policy Details
- **Student No-Show**: Student misses session without notice → **Credits forfeited**
- **Tutor No-Show**: Tutor misses session → **Credits fully refunded to student**
- Tutors mark no-shows in "Past Sessions" after session time has passed
- No-show type is recorded for analytics and dispute resolution

### Implementation
- **File**: `components/dashboard/PastSessions.js` (Tutor view)
- **Function**: `handleMarkNoShow(id, type)`
- **Utility**: `lib/sessionPolicies.js` - `handleNoShow(sessionId, noShowType)`
- **Note**: Students use the "Report Issue" button in `StudentPastSessions.js` to report tutor no-shows, which are then reviewed by an Admin. Students no longer have a direct "Mark No-Show" button to trigger automatic refunds.

### User Flow (Tutor)
1. Tutor navigates to "Past Sessions" tab
2. For completed sessions, clicks "Mark No-Show" button
3. Modal appears with the option:
   - **Student No-Show**: Student didn't attend
4. Upon selection:
   - Session status is updated
   - Credits are forfeited (paid to tutor)
   - Notification is sent to the student

### User Flow (Student)
1. Student navigates to "Past Sessions" tab
2. If a session was not attended by the tutor, or there is another issue, clicks "Report Issue"
3. Support reviews the report and manually processes refunds or corrections if necessary.

### Database Changes
- `Schedules` table columns:
  - `no_show_type`: 'student-no-show' or 'tutor-no-show'
  - `session_status`: Updated to reflect no-show status
  - `session_action`: Updated to reflect action taken
  - `credits_refunded`: Amount refunded (if tutor no-show)

---

## 5. Daily Session Limits

### Policy Details
- **Student Limit**: Maximum **5 sessions per day** (configurable)
- **Tutor Limit**: Maximum **8 sessions per day** (configurable)
- Prevents student overload and tutor burnout
- Limits are checked at booking time

### Implementation
- **File**: `components/dashboard/BookSession.js`
- **Function**: `handleBooking()` - includes daily limit check
- **Utility**: `lib/sessionPolicies.js` - `checkDailySessionLimit()`, `checkTutorDailySessionLimit()`

### Configuration
- Settings stored in `PlatformSettings` table:
  - `max_daily_sessions_per_student` (default: 5)
  - `max_daily_sessions_per_tutor` (default: 8)

### Validation
- When student attempts to book a session:
  1. System counts existing sessions for that date
  2. If count >= limit, booking is rejected
  3. User is prompted to select a different date

---

## Database Schema

### PlatformSettings Table
```sql
CREATE TABLE "PlatformSettings" (
  id BIGSERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  data_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Default Settings
```sql
INSERT INTO "PlatformSettings" (setting_key, setting_value, description, data_type) VALUES
  ('min_booking_hours_advance', '2', 'Minimum hours in advance to book a session', 'integer'),
  ('cancellation_notice_hours', '24', 'Hours notice required for full credit refund', 'integer'),
  ('rescheduling_notice_hours', '24', 'Hours notice required for rescheduling', 'integer'),
  ('max_daily_sessions_per_student', '5', 'Maximum sessions a student can book per day', 'integer'),
  ('max_daily_sessions_per_tutor', '8', 'Maximum sessions a tutor can have per day', 'integer');
```

### Schedules Table Additions
```sql
ALTER TABLE "Schedules" 
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS rescheduled_from_id BIGINT REFERENCES "Schedules"(id),
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS no_show_type TEXT CHECK (no_show_type IS NULL OR no_show_type IN ('student-no-show', 'tutor-no-show')),
ADD COLUMN IF NOT EXISTS credits_refunded NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT 'none' CHECK (cancellation_status IN ('none', 'pending', 'approved', 'rejected'));
```

---

## Components Overview

### 1. BookSession.js
- **Purpose**: Allow students to book new sessions
- **Enforces**: 2-hour advance booking, daily session limits, credit requirements
- **Features**:
  - Multi-step booking wizard
  - Real-time availability checking
  - Credit calculation and validation
  - Tutor details modal

### 2. SessionManagement.js
- **Purpose**: Allow students to manage upcoming sessions
- **Enforces**: 24-hour cancellation/rescheduling notice
- **Features**:
  - List of upcoming sessions
  - Cancellation with reason
  - Rescheduling with new date/time
  - Policy compliance warnings

### 3. PastSessions.js (Enhanced)
- **Purpose**: Allow tutors to review past sessions and mark no-shows
- **Enforces**: No-show policy
- **Features**:
  - List of completed sessions
  - Write session review
  - Mark student or tutor no-show
  - Credit forfeiture/refund tracking

### 4. sessionPolicies.js (Utility)
- **Purpose**: Centralized policy logic and validation
- **Functions**:
  - `handleNoShow()`: Process no-show and credit adjustments
  - `canCancelWithFullRefund()`: Check cancellation eligibility
  - `canRescheduleSession()`: Check rescheduling eligibility
  - `getHoursUntilSession()`: Calculate time until session
  - `meetsMinimumAdvanceBooking()`: Validate advance booking requirement
  - `checkDailySessionLimit()`: Check student daily limit
  - `checkTutorDailySessionLimit()`: Check tutor daily limit

---

## Configuration Management

### Updating Settings
To modify policy settings, update the `PlatformSettings` table:

```sql
UPDATE "PlatformSettings" 
SET setting_value = '3' 
WHERE setting_key = 'min_booking_hours_advance';
```

### Available Settings
| Setting Key | Default | Type | Description |
|---|---|---|---|
| `min_booking_hours_advance` | 2 | integer | Minimum hours in advance to book |
| `cancellation_notice_hours` | 24 | integer | Hours notice for full refund |
| `rescheduling_notice_hours` | 24 | integer | Hours notice for rescheduling |
| `max_daily_sessions_per_student` | 5 | integer | Max sessions per student per day |
| `max_daily_sessions_per_tutor` | 8 | integer | Max sessions per tutor per day |

---

## User Notifications

### Implemented Notifications
- ✅ Booking confirmation with session details
- ✅ Cancellation confirmation with refund amount
- ✅ Rescheduling confirmation with new details
- ✅ No-show alerts (student/tutor)
- ✅ Policy violation warnings (deadline passed, limit reached)

### Future Enhancement
- Email notifications for cancellations
- SMS notifications for no-shows
- Calendar invitations for bookings
- Reminder notifications 24 hours before session

---

## Testing Checklist

- [ ] Book session with 2+ hours advance notice
- [ ] Attempt to book session within 2 hours (should fail)
- [ ] Cancel session with 24+ hours notice (should refund credits)
- [ ] Attempt to cancel within 24 hours (should warn)
- [ ] Reschedule session with 24+ hours notice
- [ ] Attempt to reschedule within 24 hours (should warn)
- [ ] Mark student no-show (credits forfeited)
- [ ] Mark tutor no-show (credits refunded)
- [ ] Exceed daily session limit (should prevent booking)
- [ ] Verify credit calculations are correct

---

## Troubleshooting

### Issue: Dates not showing in booking
**Solution**: Check that tutor has availability set and meets the 2-hour advance requirement

### Issue: Cancellation button not appearing
**Solution**: Verify session is within 24 hours of start time and status is "pending" or "confirmed"

### Issue: Credits not refunding
**Solution**: Check that `credits_refunded` column is being updated and student credits are being incremented

### Issue: No-show modal not appearing
**Solution**: Ensure session has ended (current time > end_time_utc) and status is "confirmed"

---

## Future Enhancements

1. **Partial Refunds**: Implement sliding scale refunds based on cancellation timing
2. **Waitlist**: Allow students to join waitlist if daily limit reached
3. **Recurring Sessions**: Support booking recurring weekly/monthly sessions
4. **Automatic Reminders**: Send notifications 24 hours before session
5. **Dispute Resolution**: Admin interface for handling cancellation disputes
6. **Analytics Dashboard**: Track no-show rates, cancellation patterns, etc.
