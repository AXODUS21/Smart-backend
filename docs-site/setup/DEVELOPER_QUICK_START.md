# Developer Quick Start Guide: Booking Policies

## Overview
This guide helps developers understand and work with the booking policies system.

---

## Architecture

### Component Structure
```
Dashboard.js
├── BookSession.js (Student booking)
├── SessionManagement.js (Student cancellation/rescheduling)
└── PastSessions.js (Tutor no-show marking)

lib/
└── sessionPolicies.js (Shared utilities)
```

### Data Flow
```
1. BookSession.js
   ├── Fetches PlatformSettings
   ├── Validates 2-hour advance booking
   ├── Checks daily session limits
   └── Creates booking

2. SessionManagement.js
   ├── Fetches upcoming sessions
   ├── Validates 24-hour notice for cancellation
   ├── Validates 24-hour notice for rescheduling
   └── Updates session status & credits

3. PastSessions.js
   ├── Fetches completed sessions
   ├── Allows tutor to mark no-show
   └── Calls handleNoShow() utility
```

---

## Key Files & Functions

### 1. BookSession.js
**Purpose**: Multi-step booking wizard with policy enforcement

**Key Functions**:
```javascript
getAvailableDates()
// Filters dates to meet 2-hour advance requirement
// Returns: Array of valid dates

getAvailableTimeSlots()
// Gets time slots for selected date
// Returns: Array of time slots

handleBooking()
// Main booking handler
// Validates: credits, daily limits, advance booking
// Creates: new schedule entry, deducts credits
```

**Key State**:
```javascript
platformSettings = {
  min_booking_hours_advance: 2,
  max_daily_sessions_per_student: 5
}
```

### 2. SessionManagement.js
**Purpose**: Allow students to cancel/reschedule sessions

**Key Functions**:
```javascript
canCancelSession(session)
// Checks if 24+ hours until session
// Returns: boolean

canRescheduleSession(session)
// Checks if 24+ hours until session
// Returns: boolean

handleCancellation()
// Updates session status to 'cancelled'
// Refunds credits to student
// Records cancellation reason

handleRescheduling()
// Creates new session
// Marks original as 'rescheduled'
// Maintains same credits
```

**Key State**:
```javascript
platformSettings = {
  cancellation_notice_hours: 24,
  rescheduling_notice_hours: 24
}
```

### 3. PastSessions.js
**Purpose**: Allow tutors to mark sessions as no-show

**Key Functions**:
```javascript
handleMarkNoShow(id, type)
// Calls handleNoShow() utility
// Updates session status
// Adjusts credits based on type
// 'student-no-show': forfeits credits
// 'tutor-no-show': refunds credits
```

### 4. sessionPolicies.js (Utilities)
**Purpose**: Centralized policy logic

**Key Functions**:
```javascript
handleNoShow(sessionId, noShowType)
// Updates session with no-show status
// Refunds/forfeits credits
// Returns: { success, message, creditsRefunded }

canCancelWithFullRefund(sessionStartTime, requiredHours)
// Checks if cancellation deadline passed
// Returns: boolean

canRescheduleSession(sessionStartTime, requiredHours)
// Checks if rescheduling deadline passed
// Returns: boolean

getHoursUntilSession(sessionStartTime)
// Calculates time until session
// Returns: number (hours)

checkDailySessionLimit(studentId, date, maxSessions)
// Checks student daily session count
// Returns: { count, limit, canBook }

checkTutorDailySessionLimit(tutorId, date, maxSessions)
// Checks tutor daily session count
// Returns: { count, limit, canBook }
```

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

### Schedules Table (New Columns)
```sql
ALTER TABLE "Schedules" ADD COLUMN
  cancellation_requested_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  rescheduled_from_id BIGINT REFERENCES "Schedules"(id),
  rescheduled_at TIMESTAMP WITH TIME ZONE,
  no_show_type TEXT CHECK (no_show_type IN ('student-no-show', 'tutor-no-show')),
  credits_refunded NUMERIC DEFAULT 0,
  cancellation_status TEXT DEFAULT 'none' CHECK (cancellation_status IN ('none', 'pending', 'approved', 'rejected'));
```

---

## Common Tasks

### Task 1: Fetch Platform Settings
```javascript
const { data: settingsData } = await supabase
  .from("PlatformSettings")
  .select("setting_key, setting_value");

const settingsMap = {};
settingsData.forEach((setting) => {
  const value = setting.data_type === "integer" 
    ? parseInt(setting.setting_value) 
    : setting.setting_value;
  settingsMap[setting.setting_key] = value;
});
```

### Task 2: Check Advance Booking
```javascript
const now = new Date();
const minBookingHours = 2;
const minBookingTime = new Date(now.getTime() + minBookingHours * 60 * 60 * 1000);

const isValid = sessionStartTime >= minBookingTime;
```

### Task 3: Check Cancellation Eligibility
```javascript
const now = new Date();
const sessionStart = new Date(session.start_time_utc);
const hoursUntilSession = (sessionStart - now) / (1000 * 60 * 60);
const canCancel = hoursUntilSession >= 24;
```

### Task 4: Refund Credits
```javascript
// Get current credits
const { data: student } = await supabase
  .from("Students")
  .select("credits")
  .eq("id", studentId)
  .single();

// Calculate new balance
const newCredits = (student.credits || 0) + creditsToRefund;

// Update
await supabase
  .from("Students")
  .update({ credits: newCredits })
  .eq("id", studentId);
```

### Task 5: Check Daily Limit
```javascript
const { data: sessions } = await supabase
  .from("Schedules")
  .select("id")
  .eq("student_id", studentId)
  .gte("start_time_utc", startOfDay.toISOString())
  .lte("start_time_utc", endOfDay.toISOString())
  .in("status", ["pending", "confirmed"]);

const canBook = (sessions?.length || 0) < maxSessions;
```

---

## Testing

### Unit Tests
```javascript
// Test advance booking validation
test('should prevent booking within 2 hours', () => {
  const now = new Date();
  const sessionTime = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
  expect(meetsMinimumAdvanceBooking(sessionTime, 2)).toBe(false);
});

// Test cancellation eligibility
test('should allow cancellation 24+ hours before', () => {
  const now = new Date();
  const sessionTime = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours
  expect(canCancelWithFullRefund(sessionTime, 24)).toBe(true);
});

// Test daily limit
test('should prevent booking when limit reached', async () => {
  // Mock 5 existing sessions
  // Attempt 6th booking
  // Should fail
});
```

### Integration Tests
```javascript
// Test full booking flow
test('should complete booking with all validations', async () => {
  // 1. Create student with credits
  // 2. Book session (2+ hours advance)
  // 3. Verify credits deducted
  // 4. Verify session created
});

// Test cancellation flow
test('should cancel and refund credits', async () => {
  // 1. Create booking
  // 2. Cancel (24+ hours before)
  // 3. Verify credits refunded
  // 4. Verify session status = 'cancelled'
});
```

---

## Error Handling

### Common Errors
```javascript
// Insufficient credits
if (studentCredits < creditsRequired) {
  throw new Error(`Insufficient credits. Need ${creditsRequired}, have ${studentCredits}`);
}

// Booking too soon
if (!meetsMinimumAdvanceBooking(sessionTime, minHours)) {
  throw new Error(`Must book at least ${minHours} hours in advance`);
}

// Daily limit exceeded
if (existingSessions.length >= maxDailySessions) {
  throw new Error(`Maximum ${maxDailySessions} sessions per day reached`);
}

// Cancellation too late
if (!canCancelWithFullRefund(sessionTime, 24)) {
  throw new Error('Must cancel at least 24 hours in advance for full refund');
}
```

---

## Performance Tips

### 1. Cache Platform Settings
```javascript
// Fetch once on component mount
useEffect(() => {
  fetchPlatformSettings();
}, []);

// Reuse in all calculations
const minHours = platformSettings.min_booking_hours_advance;
```

### 2. Batch Database Queries
```javascript
// Instead of multiple queries
const [tutors, students, settings] = await Promise.all([
  supabase.from("Tutors").select("*"),
  supabase.from("Students").select("*"),
  supabase.from("PlatformSettings").select("*")
]);
```

### 3. Use Indexes
```sql
-- Add indexes for common queries
CREATE INDEX idx_schedules_student_date 
ON "Schedules"(student_id, start_time_utc);

CREATE INDEX idx_schedules_tutor_date 
ON "Schedules"(tutor_id, start_time_utc);

CREATE INDEX idx_schedules_status 
ON "Schedules"(status);
```

---

## Debugging

### Enable Logging
```javascript
// In sessionPolicies.js
console.log('Checking advance booking:', {
  sessionTime,
  minHours,
  isValid: meetsMinimumAdvanceBooking(sessionTime, minHours)
});

// In components
console.log('Platform settings:', platformSettings);
console.log('Daily session count:', existingSessions.length);
```

### Check Database State
```sql
-- View all settings
SELECT * FROM "PlatformSettings";

-- View session details
SELECT id, student_id, tutor_id, status, start_time_utc, 
       cancellation_requested_at, no_show_type, credits_refunded
FROM "Schedules"
WHERE id = ?;

-- View student credits
SELECT id, name, credits FROM "Students" WHERE id = ?;
```

---

## Extending the System

### Add New Policy
1. Add setting to `PlatformSettings` table
2. Create validation function in `sessionPolicies.js`
3. Use in component before action
4. Add UI warning/error message

### Example: Add Minimum Session Duration
```javascript
// 1. Add to PlatformSettings
INSERT INTO "PlatformSettings" (setting_key, setting_value, data_type)
VALUES ('min_session_duration_minutes', '30', 'integer');

// 2. Create validation function
export function meetsMinimumDuration(durationMinutes, minDuration = 30) {
  return durationMinutes >= minDuration;
}

// 3. Use in BookSession.js
if (!meetsMinimumDuration(durationMinutes, platformSettings.min_session_duration_minutes)) {
  alert('Minimum session duration is 30 minutes');
  return;
}
```

---

## Resources

- **Full Documentation**: See `BOOKING_POLICIES.md`
- **Admin Guide**: See `ADMIN_POLICY_GUIDE.md`
- **Implementation Summary**: See `IMPLEMENTATION_SUMMARY.md`
- **Supabase Docs**: https://supabase.com/docs

---

## Support

For questions or issues:
1. Check the documentation files
2. Review code comments
3. Check error logs
4. Contact team lead

---

## Version History

### v1.0 (Current)
- Initial implementation
- All core policies implemented
- Full documentation
- Ready for production
