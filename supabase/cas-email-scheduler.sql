-- Run once in the Supabase SQL Editor after enabling pg_cron, pg_net, and Vault.
-- Store the exact same cron secret set as CAS_CAMPAIGN_CRON_SECRET in Edge Function secrets.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'dispatch-cas-email-campaigns';

select cron.schedule(
  'dispatch-cas-email-campaigns',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'cas_project_url') || '/functions/v1/send-cas-email-campaigns',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cas_publishable_key'),
        'x-cas-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cas_campaign_cron_secret')
      ),
      body := '{"action":"process_due"}'::jsonb
    );
  $$
);
