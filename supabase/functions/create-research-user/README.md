# create-research-user Edge Function

Deploy with:

```bash
supabase functions deploy create-research-user
```

Required secrets are normally available automatically in Supabase Edge Functions:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Only signed-in users with `profiles.role = 'admin'` can create research-user accounts.
