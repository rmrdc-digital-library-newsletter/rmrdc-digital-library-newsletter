# RMRDC Research-to-Industry Platform v3.4.2

## Implemented
- Researcher → RMRDC validation → Investor → RMRDC review → Fabricator/Engineer → Deal Room → Commercialisation workflow.
- Investor freemium access: free discovery plus subscriber-only technology intelligence with padlock previews.
- Subscriber actions: Express Interest, Request Researcher Engagement, Request Fabrication/Scale-up, and RMRDC-facilitated engagement.
- Researcher portal now explains the connection to investors and fabricators.
- Investor portal now includes the RMRDC Synergy & Technology Deployment Network and the post-selection journey.
- Fabricator portal now includes the RMRDC Technology Deployment Network.
- Added RMRDC staff Engagement & Technology Requests page for investor and fabrication requests.
- Added database migration for secure subscription-aware access and RMRDC-managed request workflows.
- Existing technologies, opportunities, 46 patents and 34 TIC products are preserved.

## Important production step
Run `sql/SUPABASE_RTI_FREEMIUM_ENGAGEMENT_V3_4_2.sql` in the Supabase SQL Editor before using subscriber-gated database records in production. The frontend lock is for user experience; database RLS is the actual authorization layer. Supabase recommends RLS and least-privilege grants for exposed data. 
