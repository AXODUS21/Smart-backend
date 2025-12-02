# Environment Variables Checklist

## Required Environment Variables

Make sure you have the following variables in your `.env.local` file:

```env
# Stripe Keys (Required for Stripe payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# PayMongo Keys (Required for PayMongo payments)
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_SECRET_KEY=sk_test_...

# Supabase (Already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Supabase Service Role Key (REQUIRED for payment processing)
# This key bypasses RLS policies and is needed to create/update student records
# Get it from: Supabase Dashboard > Project Settings > API > service_role key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Pencil Spaces (Required for video meetings)
# Get your API key from https://pencilspaces.com/support or your account manager
NEXT_PUBLIC_PENCIL_SPACE_API_KEY=ps_live_...

# Resend (Required for email notifications)
# Get your API key from: https://resend.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional
USD_TO_PHP_RATE=56
NEXT_PUBLIC_BASE_URL=http://localhost:3000
APP_NAME=Smart Tutoring Platform
```

## Important Notes

1. **Restart the dev server** after adding/updating environment variables
   - Next.js only reads environment variables on startup
   - Stop the server (Ctrl+C) and run `npm run dev` again

2. **Variable naming is case-sensitive**
   - Make sure the names match exactly as shown above
   - No spaces around the `=` sign

3. **Secret keys should NOT be prefixed with `NEXT_PUBLIC_`**
   - `STRIPE_SECRET_KEY` (server-side only)
   - `PAYMONGO_SECRET_KEY` (server-side only)
   - Only public keys use `NEXT_PUBLIC_` prefix

4. **Test keys vs Production keys**
   - Use test keys (starting with `pk_test_` and `sk_test_`) for development
   - Use production keys (starting with `pk_live_` and `sk_live_`) for production

## Troubleshooting

### Error: "Stripe secret key not configured"
- Check if `STRIPE_SECRET_KEY` is in `.env.local`
- Make sure there are no typos in the variable name
- Restart the dev server

### Error: "PayMongo secret key not configured"
- Check if `PAYMONGO_SECRET_KEY` is in `.env.local`
- Make sure there are no typos in the variable name
- Restart the dev server

### Error: "RESEND_API_KEY is not configured"
- Check if `RESEND_API_KEY` is in `.env.local`
- Get your API key from https://resend.com
- Make sure there are no typos in the variable name
- Restart the dev server

### Error: "Unexpected token '<', "<!DOCTYPE "..." is not valid JSON"
- This usually means the API route is returning an HTML error page
- Check server logs for detailed error messages
- Verify environment variables are set correctly
- Restart the dev server

### Error: "Error creating student record" with code 42501
- This means insufficient privileges (RLS policy blocking)
- **REQUIRED**: Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env.local` file
- Get it from: Supabase Dashboard > Project Settings > API > service_role key
- The service_role key bypasses RLS policies and is needed for payment processing
- Restart the dev server after adding it

## Verification

To verify your environment variables are loaded:

1. Check the server console when starting the dev server
2. Look for any error messages about missing environment variables
3. Test the API routes directly in your browser or with a tool like Postman



