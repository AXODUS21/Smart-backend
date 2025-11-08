# Payment Integration Setup

This document describes the Stripe and PayMongo payment integration for the credits purchase system.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Stripe Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# PayMongo Keys
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_SECRET_KEY=sk_test_...

# Optional: USD to PHP conversion rate (default: 56)
# Only needed if using PayMongo (which uses PHP currency)
USD_TO_PHP_RATE=56

# Optional: Base URL for redirects (default: http://localhost:3000)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# Optional: For server-side operations
SUPABASE_SERVICE_ROLE_KEY=...
```

## How It Works

### Payment Flow

1. **User selects a credit plan** - Clicking on a plan opens the payment modal
2. **User chooses payment method** - Select between Stripe or PayMongo
3. **Payment processing**:
   - **Stripe**: Redirects to Stripe Checkout page
   - **PayMongo**: Shows embedded card form in modal
4. **Payment confirmation** - After successful payment, credits are added to the user's account
5. **Redirect** - User is redirected back to the credits page with a success message

### API Routes

#### Stripe
- `POST /api/payments/stripe/create-checkout` - Creates a Stripe checkout session
- `GET /api/payments/stripe/success` - Handles Stripe payment success and updates credits

#### PayMongo
- `POST /api/payments/paymongo/create-payment` - Creates a PayMongo payment intent
- `POST /api/payments/paymongo/confirm-payment` - Confirms PayMongo payment
- `GET /api/payments/paymongo/success` - Handles PayMongo payment success and updates credits

### Components

- **Credits.js** - Main component for displaying credit plans and current balance
- **PaymentModal.js** - Modal component for selecting payment method and processing payment

## Currency Notes

- **Stripe**: Uses USD currency
- **PayMongo**: Uses PHP currency (converted from USD using `USD_TO_PHP_RATE`)

## Testing

1. Make sure all environment variables are set
2. Start the development server: `npm run dev`
3. Navigate to the Credits page
4. Select a credit plan
5. Choose a payment method and complete the test payment

## Security Notes

- Never expose secret keys on the client-side
- All payment processing happens on the server-side
- Payment intents are verified before updating credits
- Use test keys for development, production keys for production

