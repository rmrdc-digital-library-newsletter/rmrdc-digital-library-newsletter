# Technology workflow notifications

Deploy from the repository root with:

```powershell
supabase functions deploy notify-technology-workflow
```

Configure the function secrets before testing:

```powershell
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set NOTIFICATION_FROM_EMAIL="RMRDC Research-to-Industry <alerts@yourdomain.gov.ng>"
supabase secrets set RMRDC_STAFF_EMAILS="industry@rmrdc.gov.ng,admin@rmrdc.gov.ng"
supabase secrets set ADMIN_PORTAL_URL="https://your-domain.example/admin/technology-opportunities.html"
supabase secrets set INVESTOR_PORTAL_URL="https://your-domain.example/investor-portal.html#discover"
```

`RMRDC_STAFF_EMAILS` is a comma-separated fallback/notification list. Staff and investor in-app alerts are written to `platform_notifications` using the service role. The function sends staff a review-request email when a researcher submits a technology and sends investor approval alerts when staff publishes it.

The Resend sender domain must be verified in Resend. For local testing, the default `onboarding@resend.dev` sender only works with the Resend account's permitted recipient.
