// Yealink auto-provisioning endpoint.
// Configure phone: Settings → Auto Provision → Server URL =
//   https://<host>/api/public/provision/$MAC.cfg?token=<provision_token>
// Phone fetches its own config (SIP account, ringtone URL, label) on boot.
import { createFileRoute } from "@tanstack/react-router";

function esc(v: string | null | undefined) {
  return (v ?? "").replace(/[\r\n]/g, " ");
}

export const Route = createFileRoute("/api/public/provision/$file")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const file = params.file || "";
        const m = file.match(/^([a-fA-F0-9]{12})\.cfg$/);
        if (!m) {
          return new Response("# invalid filename, expected <MAC>.cfg\n", {
            status: 404,
            headers: { "Content-Type": "text/plain" },
          });
        }
        const mac = m[1].toLowerCase();
        const url = new URL(request.url);
        const token = url.searchParams.get("token") || "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: dev } = await supabaseAdmin
          .from("phone_devices")
          .select("*")
          .eq("mac_address", mac)
          .maybeSingle();

        if (!dev) {
          return new Response(`# no device registered for ${mac}\n`, {
            status: 404,
            headers: { "Content-Type": "text/plain" },
          });
        }
        if (!token || token !== dev.provision_token) {
          return new Response("# invalid provisioning token\n", {
            status: 401,
            headers: { "Content-Type": "text/plain" },
          });
        }

        await supabaseAdmin
          .from("phone_devices")
          .update({ last_provisioned_at: new Date().toISOString() })
          .eq("id", dev.id);

        const host = url.host;
        const proto = url.protocol.replace(":", "");
        const actionBase = `${proto}://${host}/api/public/hooks/yealink-cdr`;
        const commonParams = `mac=$mac&remote=$remote&display_remote=$display_remote&local=$local&active_user=$active_user&call_id=$call_id`;

        const cfg = [
          `#!version:1.0.0.1`,
          `# Yealink auto-provisioning for ${esc(dev.label || mac)}`,
          ``,
          `## SIP Account 1 ##`,
          `account.1.enable = 1`,
          `account.1.label = ${esc(dev.label || "")}`,
          `account.1.display_name = ${esc(dev.label || "")}`,
          `account.1.auth_name = ${esc(dev.sip_username)}`,
          `account.1.user_name = ${esc(dev.sip_username)}`,
          `account.1.password = ${esc(dev.sip_password)}`,
          `account.1.sip_server.1.address = ${esc(dev.sip_server)}`,
          `account.1.sip_server.1.port = ${dev.sip_port ?? 5060}`,
          ``,
          `## Custom Ringtone ##`,
          dev.ringtone_url ? `ringtone.url = ${esc(dev.ringtone_url)}` : `# no custom ringtone`,
          ``,
          `## Action URLs — CRM event push ##`,
          `action_url.incoming_call = ${actionBase}?event=incoming&${commonParams}`,
          `action_url.outgoing_call = ${actionBase}?event=outgoing&${commonParams}`,
          `action_url.call_established = ${actionBase}?event=connected&${commonParams}`,
          `action_url.call_terminated = ${actionBase}?event=disconnected&${commonParams}&duration=$duration`,
          `action_url.missed_call = ${actionBase}?event=missed&${commonParams}`,
          ``,
          `## Extra ##`,
          ...Object.entries((dev.extra_config as Record<string, any>) || {}).map(
            ([k, v]) => `${k} = ${esc(String(v))}`,
          ),
          ``,
        ].join("\n");

        return new Response(cfg, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
