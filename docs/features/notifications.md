# Feature: Communications (Notifications)
Automated multi-channel alerts to keep users engaged and informed.

## System Architecture
- Powered by **Resend** for high-deliverability transactional emails.
- Managed via Supabase Edge Functions for asynchronous processing.

## Notification Types
- **Auth**: Signup welcome, verification emails.
- **Booking**: Confirmation, reschedule notifications, cancellation alerts.
- **Reminders**: Automated alerts sent 24 hours and 1 hour before a scheduled session.
- **Financial**: Low credit warnings, payout processing confirmations.
- **Administrative**: Announcement broadcasts.

## Templates
- Uses customizable MJML/HTML templates.
- Support for dynamic data injection (e.g., Student Name, Session Time, Meeting Link).
