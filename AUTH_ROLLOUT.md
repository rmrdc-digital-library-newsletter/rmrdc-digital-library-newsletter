# Authentication rollout status

Live Supabase project inspected on 25 September 2026.

- Email/password signup enabled; confirmation email required.
- Existing `auth.users` trigger trusted arbitrary signup metadata for admin/editor. Replaced with a public-role allow list and a profile update role guard in `supabase/secure_portal_registration.sql`. SQL editor returned success.
- `user_interests` and `custom_interests` had RLS enabled but no policies. Added per-user select, insert, delete policies. SQL editor returned success.
- Auth Site URL is `https://rmrdc-cas.netlify.app`; login and reset-password HTML URLs are now allowed. Localhost redirects remain for development.
- Site code now sends sign-up confirmation to its own login page, completes profile and role-specific fields after confirmation, and syncs interests. The client cannot confer staff roles.

Researcher acceptance check: publish updated frontend to a staging URL allowed in Auth redirects; register a fresh researcher with a mailbox you control, confirm email, sign in, verify `profiles.role=researcher` and a matching `researcher_profiles` row, then check sign-out, password reset and access denial for `/admin/index.html`. The same test should be repeated for the other roles later.

End-to-end verification still requires deploying the updated source and a controlled test mailbox. The live site currently serves older sign-in code. Do not call sign-up complete until the confirmation link and portal redirect have been exercised.
