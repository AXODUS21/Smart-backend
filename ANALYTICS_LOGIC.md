# Analytics Logic Documentation

## Overview
This document explains the current analytics calculations (Cash-Based Revenue & Fixed Tutor Pay) implemented in the dashboard, now separated by currency (**USD** and **PHP**).

## 1. Revenue (Cash Basis)
**Source**: `transactions` table.
**Logic**: Revenue is recognized **when credits are purchased**, not when they are used.
-   **Trigger**: A student or principal buys credits.
-   **Calculation**:
    -   **USD Revenue**: Sum of `amount` where `currency` is 'usd'.
    -   **PHP Revenue**: Sum of `amount` where `currency` is 'php'.

## 2. Expenses (Tutor Pay)
**Source**: `Schedules` table (Completed sessions).
**Logic**: Tutor pay is calculated based on **completed sessions** and the tutor's **region**.
-   **Trigger**: Session status is `completed`, `successful`, or `student-no-show`.
-   **Rates**:
    -   **PH Tutors** (Region: 'PH'): **₱180** per hour (2 credits).
    -   **International Tutors** (Region: 'US'): **$3.00** per hour (2 credits).
-   **Calculation**:
    -   **USD Expenses**: Sum of pay for International Tutors.
    -   **PHP Expenses**: Sum of pay for PH Tutors.

## 3. Net Profit (Company Share)
**Formula**: `Total Revenue - Total Tutor Pay` (calculated separately for each currency).
-   **USD Profit**: `Total USD Revenue - Total USD Expenses`.
-   **PHP Profit**: `Total PHP Revenue - Total PHP Expenses`.

## 4. Lesson Hours & Bookings
**Source**: `Schedules` table.
-   **Total Lesson Hours**: Sum of duration (in hours) for bookings where `session_status` is `successful`.
-   **Other Bookings**: Breakdown by status (Pending, Confirmed, Cancelled, Rejected) is still provided for operational tracking.
