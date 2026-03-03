# Features Guide: Smart Tutoring Platform

This document is the primary index for the features and systems implemented in the Smart Tutoring Platform. Use the links below to navigate to detailed documentation for each module.

## 📌 Core Documentation Hubs

- [**Role-Based Guides**](ROLE_BASED_GUIDE.md) - Instructions tailored for Students, Tutors, Principals, and Admins.
- [**Developer Setup & Guides**](guides/setup/DEVELOPER_QUICK_START.md) - Quick start, environment setup, and migrations.

---

## 🛠️ Functional Modules

Detailed technical and functional documentation for each platform component:

### 1. [Booking & Scheduling Engine](features/booking_engine.md)
*   **Overview**: Real-time availability, slot management, and session lifecycles.
*   **Policies**: [Booking Policies](guides/policies/BOOKING_POLICIES.md) | [Admin Policy Guide](guides/policies/ADMIN_POLICY_GUIDE.md)

### 2. [Economics (Credits & Payments)](features/credits_payments.md)
*   **Overview**: Credit-based economy, regional pricing, and automated tutor payouts.
*   **Setup**: [Payment Setup](guides/setup/PAYMENT_SETUP.md) | [Automatic Payouts](guides/setup/AUTOMATIC_PAYOUT_SETUP.md)

### 3. [School Infrastructure](features/school_system.md)
*   **Overview**: Institutional management for Principals and school-wide credits/vouchers.

### 4. [Communications (Notifications)](features/notifications.md)
*   **Overview**: Email trigger logic, Resend integration, and multi-language support.
*   **Setup**: [Notification Env Vars](guides/setup/NOTIFICATION_ENV_VARIABLES.md)

### 5. [Analytics & Financial Hub](features/analytics.md)
*   **Overview**: Revenue tracking, platform-wide metrics, and financial reporting.

---

## 🏗️ Technical Architecture

*   **Framework**: Next.js 15 (App Router)
*   **Backend**: Supabase (Postgres, Auth, Edge Functions, Storage)
*   **Modern Styling**: Vanilla CSS & Tailwind CSS
*   **Media**: Remotion integration for dynamic playback.
*   **Email Engine**: Resend API.

---

## 🗄️ Maintenance & Archive

- [**Client Handoff Guide**](CLIENT_HANDOFF_GUIDE.md) - Essential info for platform owners.
- [**Historical Fixes Archive**](archive/fixes/) - History of critical patches and debugging sessions.
- [**Implementation Logs**](archive/implementation/) - Legacy documentation and detailed logic summaries.

---
*For role-specific instructions, see the [ROLE_BASED_GUIDE.md](ROLE_BASED_GUIDE.md).*
