# notify-publication-subscribers Edge Function

This function sends publication email alerts only to registered research users whose `research_areas` overlap the uploaded publication's `research_areas`.

Required Supabase secrets:

```bash
supabase secrets set RESEND_API_KEY="your_resend_api_key"
supabase secrets set NOTIFICATION_FROM_EMAIL="RMRDC Digital Library <library@yourdomain.gov.ng>"
supabase secrets set SITE_URL="https://your-site.netlify.app"
```

Deploy:

```bash
supabase functions deploy notify-publication-subscribers
```
