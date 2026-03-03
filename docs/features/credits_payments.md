# Feature: Economics (Credits & Payments)
The internal economy system designed for simplicity and regional flexibility.

## The Credit System
- **Unit**: 1 Credit = 30 minutes of tutoring.
- **Flexibility**: Decouples payments from sessions, allowing bulk purchases and easy refunds.
- **Ledger**: Every credit transaction is logged in the `Credits` or dedicated transaction tables.

## Payment Gateways
- **PayMongo**: Primary gateway for Filipino users, supporting GCash, Maya, and QRPH.
- **Stripe**: Gateway for international credit and debit card payments.

## Regional Pricing
- Users are assigned a region (**PH** or **US/Global**) during signup.
- Pricing tiers for credit packages differ by region to account for local economic conditions.

## Tutor Withdrawals
- Tutors earn credits for every completed session.
- Credits are converted back to currency (PHP or USD) based on regional rates during the withdrawal process.
- Withdrawals are processed twice monthly (15th and 30th).
