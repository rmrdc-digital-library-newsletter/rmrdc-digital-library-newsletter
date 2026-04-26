import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeSiteUrl(value: string | undefined) {
  return (value || '').replace(/\/$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'RMRDC Digital Library <onboarding@resend.dev>';

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not set in Supabase Edge Function secrets.');
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileError || !['admin', 'editor'].includes(profile?.role)) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const publicationId = body.publication_id;
    const siteUrl = normalizeSiteUrl(body.site_url || Deno.env.get('SITE_URL'));
    if (!publicationId) throw new Error('publication_id is required.');

    const { data: publication, error: pubError } = await adminClient
      .from('publications')
      .select('id, title, authors, type, year, abstract, research_areas')
      .eq('id', publicationId)
      .single();
    if (pubError) throw pubError;

    const { data: subscribers, error: matchError } = await adminClient
      .rpc('get_matching_research_subscribers', { pub_id: publicationId });
    if (matchError) throw matchError;

    if (!subscribers?.length) {
      return new Response(JSON.stringify({ sent: 0, matched: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    const errors: Array<{ email: string; message: string }> = [];
    const viewUrl = siteUrl ? `${siteUrl}/viewer.html?id=${publication.id}` : '';

    for (const subscriber of subscribers) {
      const matchingAreas = (subscriber.research_areas || [])
        .filter((area: string) => (publication.research_areas || []).includes(area));

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#153321">
          <h2 style="color:#0f5a2d;margin-bottom:8px">New RMRDC publication in your research area</h2>
          <p>Dear ${subscriber.full_name},</p>
          <p>A new publication has been added to the RMRDC Digital Library that matches your research preferences.</p>
          <h3 style="margin-bottom:4px">${publication.title}</h3>
          <p><strong>Authors:</strong> ${publication.authors || 'N/A'}<br>
          <strong>Type:</strong> ${publication.type || 'Publication'}<br>
          <strong>Year:</strong> ${publication.year || 'N/A'}<br>
          <strong>Matched area(s):</strong> ${matchingAreas.join(', ') || 'Your selected research preferences'}</p>
          <p>${publication.abstract || ''}</p>
          ${viewUrl ? `<p><a href="${viewUrl}" style="background:#0f5a2d;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Open publication</a></p>` : ''}
          <p style="color:#5c6f63;font-size:13px">RMRDC Digital Library</p>
        </div>`;

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [subscriber.email],
            subject: `New RMRDC publication: ${publication.title}`,
            html,
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Email API failed with status ${response.status}`);
        }

        await adminClient.from('publication_notifications').upsert({
          publication_id: publication.id,
          subscriber_id: subscriber.subscriber_id,
          email: subscriber.email,
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
        }, { onConflict: 'publication_id,subscriber_id' });
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ email: subscriber.email, message });
        await adminClient.from('publication_notifications').upsert({
          publication_id: publication.id,
          subscriber_id: subscriber.subscriber_id,
          email: subscriber.email,
          status: 'failed',
          error_message: message,
        }, { onConflict: 'publication_id,subscriber_id' });
      }
    }

    return new Response(JSON.stringify({ sent, matched: subscribers.length, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
