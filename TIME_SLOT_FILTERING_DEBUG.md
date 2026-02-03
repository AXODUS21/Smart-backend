# Time Slot Filtering Debug Analysis

## Issue Reported
User was able to see and select a time slot (9:00 AM on Feb 4, 2026) that was already booked, and received an alert instead of the time being hidden.

## Root Cause Analysis

### Potential Issues Identified:

1. **Timezone Mismatch (FIXED ✅)**
   - **Problem**: The booking fetch was using `new Date(selectedDate)` which interprets dates in local timezone
   - **Impact**: If user is in timezone UTC+8, "2026-02-04" becomes "2026-02-03 16:00 UTC"
   - **Fix**: Changed to parse date components and use `Date.UTC()` for consistent UTC handling
   
   ```javascript
   // Before (❌ Timezone dependent)
   const dateStart = new Date(selectedDate);
   dateStart.setHours(0, 0, 0, 0);
   
   // After (✅ UTC consistent)
   const [year, month, day] = selectedDate.split("-");
   const dateStart = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
   ```

2. **Race Condition**
   - **Scenario**: Time slots render before bookings are fetched
   - **Current Protection**: useEffect dependencies ensure re-render when bookings load
   - **Monitoring**: Added console logs to track fetch timing

3. **Overlap Logic**
   - **Formula**: `slotStart < bookingEnd && slotEnd > bookingStart`
   - **Verified**: This correctly catches all overlap types
   - **Monitoring**: Added detailed overlap detection logging

## Debug Logging Added

### 1. Booking Fetch Logging
```javascript
console.log("Fetching bookings for tutor:", tutorData.id, "on date:", selectedDate);
console.log("Date range (UTC):", dateStart.toISOString(), "to", dateEnd.toISOString());
console.log("Found bookings:", data);
```

### 2. Filtering Logging
```javascript
console.log("Total time slots generated:", timeSlots.length);
console.log("Tutor bookings to check against:", tutorBookings.length, tutorBookings);
console.log("Available slots after filtering:", availableSlots.length);
```

### 3. Overlap Detection Logging
```javascript
if (overlaps) {
  console.log("OVERLAP DETECTED:");
  console.log("  Slot:", slot.time, "(", slotStartUTC.toISOString(), "-", slotEndUTC.toISOString(), ")");
  console.log("  Booking:", bookingStart.toISOString(), "-", bookingEnd.toISOString());
}
```

## Testing Instructions

### Step 1: Open Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Clear console

### Step 2: Navigate to Book Session
1. Select a tutor who has existing bookings
2. Select a date with bookings
3. Watch console output

### Expected Console Output:
```
Fetching bookings for tutor: 123 on date: 2026-02-04
Date range (UTC): 2026-02-04T00:00:00.000Z to 2026-02-04T23:59:59.999Z
Found bookings: [{start_time_utc: "2026-02-04T01:00:00.000Z", end_time_utc: "2026-02-04T02:00:00.000Z", status: "confirmed"}]
Total time slots generated: 20
Tutor bookings to check against: 1 [{...}]
OVERLAP DETECTED:
  Slot: 9:00 AM ( 2026-02-04T01:00:00.000Z - 2026-02-04T01:30:00.000Z )
  Booking: 2026-02-04T01:00:00.000Z - 2026-02-04T02:00:00.000Z
OVERLAP DETECTED:
  Slot: 9:30 AM ( 2026-02-04T01:30:00.000Z - 2026-02-04T02:00:00.000Z )
  Booking: 2026-02-04T01:00:00.000Z - 2026-02-04T02:00:00.000Z
Available slots after filtering: 18
```

### Step 3: Verify Filtering
1. Check that booked times don't appear in the UI
2. If they still appear, check console for:
   - Was the booking fetch successful?
   - Are bookings being found?
   - Is overlap detection working?
   - Is tutorBookings array populated?

## Possible Remaining Issues

### Issue 1: Empty tutorBookings Array
**Symptom**: Console shows "Tutor bookings to check against: 0"
**Causes**:
- Tutor ID mismatch
- Date range query not matching stored dates
- Status filter excluding bookings
**Solution**: Check database directly for the tutor's bookings

### Issue 2: Timezone Still Mismatched
**Symptom**: Overlap detection not triggering despite bookings existing
**Causes**:
- Booking stored in different timezone format
- Slot UTC calculation incorrect
**Solution**: Compare UTC timestamps in console logs

### Issue 3: Component Re-render Issue
**Symptom**: Bookings fetched but slots not re-filtered
**Causes**:
- getAvailableTimeSlots() not re-running after tutorBookings updates
- React not detecting state change
**Solution**: Verify useEffect dependencies and state updates

## Database Query to Verify Bookings

```sql
-- Check what bookings exist for a specific tutor and date
SELECT 
  id,
  tutor_id,
  student_id,
  start_time_utc,
  end_time_utc,
  status,
  subject
FROM "Schedules"
WHERE tutor_id = [TUTOR_ID]
  AND start_time_utc >= '2026-02-04T00:00:00.000Z'
  AND start_time_utc <= '2026-02-04T23:59:59.999Z'
  AND status IN ('pending', 'confirmed')
ORDER BY start_time_utc;
```

## Next Steps

1. **Test with logging enabled**
   - Book a session and watch console
   - Verify bookings are fetched
   - Verify filtering is working

2. **If issue persists**:
   - Share console output
   - Check database for actual booking times
   - Verify tutor ID matches

3. **Once confirmed working**:
   - Remove console.log statements
   - Add user-friendly "No available times" message
   - Consider adding loading state while fetching bookings

## Performance Considerations

- Bookings are fetched on every tutor/date change
- Filtering runs on every render
- For tutors with many bookings (100+), consider:
  - Caching bookings
  - Server-side filtering
  - Pagination of time slots

## Success Criteria

✅ Booked time slots do not appear in the selection UI
✅ Console logs show correct booking fetch and filtering
✅ No timezone-related bugs
✅ Overlap detection catches all scenarios
✅ Race conditions handled properly
