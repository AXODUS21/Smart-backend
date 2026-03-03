# Feature: Booking & Scheduling Engine
The heart of the platform, managing time slots and session lifecycle.

## Core Mechanics
- **Slot Management**: Tutors define 30-minute availability slots in their calendar.
- **Real-time Discovery**: Students browse available slots based on subject and tutor filters.
- **Credit Locking**: Credits are deducted and "locked" upon booking.
- **Pencil Spaces Integration**: A unique virtual classroom link is automatically generated for every confirmed session.

## Booking Policies
- **Advance Booking**: Students must book at least **2 hours** before the slot start time.
- **Cancellation/Rescheduling**: Changes must be made at least **24 hours** in advance for a full credit refund.
- **Limits**: Configurable daily session limits per student/tutor to prevent burnout.

## Session Lifecycle
1. `Scheduled`: Session is booked and awaiting start time.
2. `In Progress`: Meeting room is active.
3. `Completed`: Tutor marks session as finished.
4. `No-Show`: Categorized as Student No-Show (credits forfeited) or Tutor No-Show (credits refunded).
