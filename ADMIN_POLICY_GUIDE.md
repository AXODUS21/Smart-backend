# Admin Guide: Booking Policies Configuration

## Quick Reference

### Current Policy Settings
```
Minimum Advance Booking: 2 hours
Cancellation Notice Required: 24 hours
Rescheduling Notice Required: 24 hours
Max Student Sessions/Day: 5
Max Tutor Sessions/Day: 8
```

---

## How to Update Policies

### Method 1: Database Direct Update (Recommended)

Connect to your Supabase database and run:

```sql
-- Update minimum advance booking hours
UPDATE "PlatformSettings" 
SET setting_value = '3' 
WHERE setting_key = 'min_booking_hours_advance';

-- Update cancellation notice hours
UPDATE "PlatformSettings" 
SET setting_value = '48' 
WHERE setting_key = 'cancellation_notice_hours';

-- Update rescheduling notice hours
UPDATE "PlatformSettings" 
SET setting_value = '48' 
WHERE setting_key = 'rescheduling_notice_hours';

-- Update max daily sessions for students
UPDATE "PlatformSettings" 
SET setting_value = '10' 
WHERE setting_key = 'max_daily_sessions_per_student';

-- Update max daily sessions for tutors
UPDATE "PlatformSettings" 
SET setting_value = '12' 
WHERE setting_key = 'max_daily_sessions_per_tutor';
```

### Method 2: Check Current Settings

```sql
SELECT setting_key, setting_value, description 
FROM "PlatformSettings" 
ORDER BY setting_key;
```

---

## Policy Descriptions

### 1. Minimum Advance Booking (min_booking_hours_advance)
- **What it does**: Prevents students from booking sessions too close to the start time
- **Default**: 2 hours
- **Recommended**: 2-4 hours
- **Impact**: Affects booking availability in the "Book Sessions" tab

**Example scenarios**:
- If set to 2: Student can book a session starting at 3:00 PM if it's currently 1:00 PM
- If set to 4: Student can book a session starting at 3:00 PM only if it's currently 11:00 AM or earlier

### 2. Cancellation Notice Hours (cancellation_notice_hours)
- **What it does**: Determines how much notice is required for a full credit refund
- **Default**: 24 hours
- **Recommended**: 24-48 hours
- **Impact**: Affects cancellation eligibility in "Manage Sessions" tab

**Example scenarios**:
- If set to 24: Student can cancel with full refund if session is 24+ hours away
- If set to 48: Student must cancel 48+ hours in advance for full refund

### 3. Rescheduling Notice Hours (rescheduling_notice_hours)
- **What it does**: Determines how much notice is required to reschedule a session
- **Default**: 24 hours
- **Recommended**: 24-48 hours
- **Impact**: Affects rescheduling eligibility in "Manage Sessions" tab

**Example scenarios**:
- If set to 24: Student can reschedule if session is 24+ hours away
- If set to 48: Student must reschedule 48+ hours in advance

### 4. Max Daily Sessions Per Student (max_daily_sessions_per_student)
- **What it does**: Limits how many sessions a student can book on the same day
- **Default**: 5 sessions
- **Recommended**: 3-8 sessions
- **Impact**: Prevents overbooking by students

**Example scenarios**:
- If set to 5: Student can book up to 5 sessions on Monday
- If set to 3: Student can only book 3 sessions on Monday

### 5. Max Daily Sessions Per Tutor (max_daily_sessions_per_tutor)
- **What it does**: Limits how many sessions a tutor can have on the same day
- **Default**: 8 sessions
- **Recommended**: 6-12 sessions
- **Impact**: Prevents tutor burnout

**Example scenarios**:
- If set to 8: Tutor can have up to 8 sessions on Monday
- If set to 12: Tutor can have up to 12 sessions on Monday

---

## Common Configuration Scenarios

### Scenario 1: Strict Policies (Tutor-Friendly)
```sql
UPDATE "PlatformSettings" SET setting_value = '4' WHERE setting_key = 'min_booking_hours_advance';
UPDATE "PlatformSettings" SET setting_value = '48' WHERE setting_key = 'cancellation_notice_hours';
UPDATE "PlatformSettings" SET setting_value = '48' WHERE setting_key = 'rescheduling_notice_hours';
UPDATE "PlatformSettings" SET setting_value = '3' WHERE setting_key = 'max_daily_sessions_per_student';
UPDATE "PlatformSettings" SET setting_value = '6' WHERE setting_key = 'max_daily_sessions_per_tutor';
```

### Scenario 2: Flexible Policies (Student-Friendly)
```sql
UPDATE "PlatformSettings" SET setting_value = '1' WHERE setting_key = 'min_booking_hours_advance';
UPDATE "PlatformSettings" SET setting_value = '12' WHERE setting_key = 'cancellation_notice_hours';
UPDATE "PlatformSettings" SET setting_value = '12' WHERE setting_key = 'rescheduling_notice_hours';
UPDATE "PlatformSettings" SET setting_value = '10' WHERE setting_key = 'max_daily_sessions_per_student';
UPDATE "PlatformSettings" SET setting_value = '15' WHERE setting_key = 'max_daily_sessions_per_tutor';
```

### Scenario 3: Balanced Policies (Default)
```sql
UPDATE "PlatformSettings" SET setting_value = '2' WHERE setting_key = 'min_booking_hours_advance';
UPDATE "PlatformSettings" SET setting_value = '24' WHERE setting_key = 'cancellation_notice_hours';
UPDATE "PlatformSettings" SET setting_value = '24' WHERE setting_key = 'rescheduling_notice_hours';
UPDATE "PlatformSettings" SET setting_value = '5' WHERE setting_key = 'max_daily_sessions_per_student';
UPDATE "PlatformSettings" SET setting_value = '8' WHERE setting_key = 'max_daily_sessions_per_tutor';
```

---

## Monitoring & Analytics

### View All Cancellations
```sql
SELECT 
  s.id,
  s.subject,
  s.start_time_utc,
  s.cancellation_requested_at,
  s.cancellation_reason,
  s.credits_refunded,
  st.name as student_name,
  t.first_name || ' ' || t.last_name as tutor_name
FROM "Schedules" s
LEFT JOIN "Students" st ON s.student_id = st.id
LEFT JOIN "Tutors" t ON s.tutor_id = t.id
WHERE s.status = 'cancelled'
ORDER BY s.cancellation_requested_at DESC;
```

### View All No-Shows
```sql
SELECT 
  s.id,
  s.subject,
  s.start_time_utc,
  s.no_show_type,
  s.credits_refunded,
  st.name as student_name,
  t.first_name || ' ' || t.last_name as tutor_name
FROM "Schedules" s
LEFT JOIN "Students" st ON s.student_id = st.id
LEFT JOIN "Tutors" t ON s.tutor_id = t.id
WHERE s.no_show_type IS NOT NULL
ORDER BY s.start_time_utc DESC;
```

### View All Rescheduled Sessions
```sql
SELECT 
  s.id,
  s.subject,
  s.start_time_utc,
  s.rescheduled_at,
  s.rescheduled_from_id,
  st.name as student_name,
  t.first_name || ' ' || t.last_name as tutor_name
FROM "Schedules" s
LEFT JOIN "Students" st ON s.student_id = st.id
LEFT JOIN "Tutors" t ON s.tutor_id = t.id
WHERE s.rescheduled_from_id IS NOT NULL
ORDER BY s.rescheduled_at DESC;
```

### Student Cancellation Rate
```sql
SELECT 
  st.name,
  COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancellations,
  COUNT(s.id) as total_bookings,
  ROUND(100.0 * COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) / COUNT(s.id), 2) as cancellation_rate
FROM "Students" st
LEFT JOIN "Schedules" s ON st.id = s.student_id
GROUP BY st.id, st.name
HAVING COUNT(s.id) > 0
ORDER BY cancellation_rate DESC;
```

### Tutor No-Show Rate
```sql
SELECT 
  t.first_name || ' ' || t.last_name as tutor_name,
  COUNT(CASE WHEN s.no_show_type = 'tutor-no-show' THEN 1 END) as tutor_no_shows,
  COUNT(CASE WHEN s.status = 'confirmed' AND s.end_time_utc < NOW() THEN 1 END) as completed_sessions,
  ROUND(100.0 * COUNT(CASE WHEN s.no_show_type = 'tutor-no-show' THEN 1 END) / 
    NULLIF(COUNT(CASE WHEN s.status = 'confirmed' AND s.end_time_utc < NOW() THEN 1 END), 0), 2) as no_show_rate
FROM "Tutors" t
LEFT JOIN "Schedules" s ON t.id = s.tutor_id
GROUP BY t.id, t.first_name, t.last_name
HAVING COUNT(CASE WHEN s.status = 'confirmed' AND s.end_time_utc < NOW() THEN 1 END) > 0
ORDER BY no_show_rate DESC;
```

---

## Troubleshooting

### Issue: Settings not taking effect
**Solution**: 
1. Clear browser cache
2. Refresh the page
3. Check that the setting_key is spelled correctly
4. Verify the setting_value is valid (numeric for integers)

### Issue: Students can't book sessions
**Solution**:
1. Check `min_booking_hours_advance` setting
2. Verify tutor has availability set
3. Ensure current time + advance hours < session start time

### Issue: Cancellation button not appearing
**Solution**:
1. Check `cancellation_notice_hours` setting
2. Verify session is in the future
3. Ensure session status is "pending" or "confirmed"

### Issue: Daily limit not working
**Solution**:
1. Check `max_daily_sessions_per_student` setting
2. Verify the setting_value is numeric
3. Check that existing sessions are counted correctly

---

## Best Practices

### For Tutoring Platforms
1. **Set advance booking to 2-4 hours** - Gives tutors time to prepare
2. **Set cancellation notice to 24 hours** - Fair to both parties
3. **Set daily student limit to 5-8** - Prevents overload
4. **Set daily tutor limit to 8-12** - Prevents burnout

### For High-Demand Platforms
1. **Increase advance booking to 4-6 hours** - Better planning
2. **Increase cancellation notice to 48 hours** - Reduces no-shows
3. **Decrease daily limits** - Ensures quality over quantity

### For Flexible Platforms
1. **Decrease advance booking to 1-2 hours** - Last-minute bookings
2. **Decrease cancellation notice to 12 hours** - More flexibility
3. **Increase daily limits** - More availability

---

## Impact on Users

### When You Increase Advance Booking Hours
- ✅ Tutors have more prep time
- ✅ Fewer last-minute cancellations
- ❌ Students have less flexibility
- ❌ Fewer bookings overall

### When You Increase Cancellation Notice
- ✅ Tutors have more certainty
- ✅ Fewer no-shows
- ❌ Students have less flexibility
- ❌ More cancellations within notice period

### When You Decrease Daily Limits
- ✅ Better quality sessions
- ✅ Prevents tutor burnout
- ❌ Students have less availability
- ❌ Longer wait times for bookings

---

## Support

For questions or issues with policy configuration:
1. Check the `BOOKING_POLICIES.md` file for detailed documentation
2. Review the troubleshooting section above
3. Check database logs for errors
4. Contact development team if needed

---

## Change Log

### Version 1.0 (Current)
- Initial implementation of all booking policies
- Configurable settings via PlatformSettings table
- Full credit management system
- No-show tracking and enforcement
