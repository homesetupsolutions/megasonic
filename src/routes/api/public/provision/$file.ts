// Universal IP-phone auto-provisioning endpoint. Supports:
//   Yealink:      /api/public/provision/<MAC>.cfg?token=...
//   Grandstream:  /api/public/provision/cfg<MAC>.xml?token=...
//   Generic info: /api/public/provision/<MAC>.txt?token=...   (plain-text setup instructions)
import { createFileRoute } from "@tanstack/react-router";

function esc(v: string | null | undefined) {
  return (v ?? "").replace(/[\r\n]/g, " ");
}
function xmlEsc(v: string | null | undefined) {
  return (v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseFile(file: string): { mac: string; format: "yealink" | "grandstream" | "generic" } | null {
  // Yealink: <MAC>.cfg
  let m = file.match(/^([a-fA-F0-9]{12})\.cfg$/);
  if (m) return { mac: m[1].toLowerCase(), format: "yealink" };
  // Grandstream: cfg<MAC>.xml  or cfg<MAC>
  m = file.match(/^cfg([a-fA-F0-9]{12})(?:\.xml)?$/);
  if (m) return { mac: m[1].toLowerCase(), format: "grandstream" };
  // Generic plain-text instructions
  m = file.match(/^([a-fA-F0-9]{12})\.txt$/);
  if (m) return { mac: m[1].toLowerCase(), format: "generic" };
  return null;
}

export const Route = createFileRoute("/api/public/provision/$file")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const parsed = parseFile(params.file || "");
        if (!parsed) {
          return new Response(
            "# invalid filename. Use <MAC>.cfg (Yealink), cfg<MAC>.xml (Grandstream), or <MAC>.txt (generic).\n",
            { status: 404, headers: { "Content-Type": "text/plain" } },
          );
        }
        const { mac, format } = parsed;
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

        if (format === "yealink") {
          const p = `mac=$mac&remote=$remote&display_remote=$display_remote&local=$local&active_user=$active_user&call_id=$call_id`;
          const cfg = [
            `#!version:1.0.0.1`,
            `# Yealink config for ${esc(dev.label || mac)}`,
            ``,
            `account.1.enable = 1`,
            `account.1.label = ${esc(dev.label || "")}`,
            `account.1.display_name = ${esc(dev.label || "")}`,
            `account.1.auth_name = ${esc(dev.sip_username)}`,
            `account.1.user_name = ${esc(dev.sip_username)}`,
            `account.1.password = ${esc(dev.sip_password)}`,
            `account.1.sip_server.1.address = ${esc(dev.sip_server)}`,
            `account.1.sip_server.1.port = ${dev.sip_port ?? 5060}`,
            dev.ringtone_url ? `ringtone.url = ${esc(dev.ringtone_url)}` : `# no custom ringtone`,
            ``,
            `action_url.incoming_call = ${actionBase}?event=incoming&${p}`,
            `action_url.outgoing_call = ${actionBase}?event=outgoing&${p}`,
            `action_url.call_established = ${actionBase}?event=connected&${p}`,
            `action_url.call_terminated = ${actionBase}?event=disconnected&${p}&duration=$duration`,
            `action_url.missed_call = ${actionBase}?event=missed&${p}`,
            ``,
          ].join("\n");
          return new Response(cfg, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
        }

        if (format === "grandstream") {
          // Grandstream uses P-codes. Account 1: P47 server, P35 user, P36 auth, P34 password,
          // P3 account name. Action URLs vary by model — most modern GXP/GRP/GXV
          // expose them under "Call Features → Call Progress Tone / Web Service" with names
          // pvalue keys P22099+ for "Action URL on Incoming/Outgoing/Connected/Disconnected/Missed".
          const p = `mac=%MAC%&remote=%CALLER_NUM%&display_remote=%CALLER_NAME%&local=%CALLED_NUM%`;
          const fields: Array<[string, string]> = [
            ["P271", "1"], // account 1 active
            ["P270", esc(dev.label || "")], // account name
            ["P47", esc(dev.sip_server || "")], // SIP server
            ["P35", esc(dev.sip_username || "")], // SIP user id
            ["P36", esc(dev.sip_username || "")], // authenticate id
            ["P34", esc(dev.sip_password || "")], // password
            ["P3", esc(dev.label || "")], // display name
            ["P22099", `${actionBase}?event=incoming&${p}`],
            ["P22100", `${actionBase}?event=outgoing&${p}`],
            ["P22101", `${actionBase}?event=connected&${p}`],
            ["P22102", `${actionBase}?event=disconnected&${p}&duration=%DURATION%`],
            ["P22103", `${actionBase}?event=missed&${p}`],
          ];
          if (dev.ringtone_url) fields.push(["P31", esc(dev.ringtone_url)]);
          const xml = [
            `<?xml version="1.0" encoding="UTF-8" ?>`,
            `<gs_provision version="1">`,
            `  <mac>${mac.toUpperCase()}</mac>`,
            `  <config version="1">`,
            ...fields.map(([k, v]) => `    <${k}>${xmlEsc(v)}</${k}>`),
            `  </config>`,
            `</gs_provision>`,
            ``,
          ].join("\n");
          return new Response(xml, { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
        }

        // Generic plain-text instructions for any other brand (Cisco, Polycom, Fanvil, Snom…)
        const generic = [
          `# Manual setup for ${esc(dev.label || mac)} (${mac})`,
          ``,
          `## 1. SIP Account`,
          `Server:   ${esc(dev.sip_server)}`,
          `Port:     ${dev.sip_port ?? 5060}`,
          `Username: ${esc(dev.sip_username)}`,
          `Password: ${esc(dev.sip_password)}`,
          ``,
          `## 2. Action URLs / HTTP Notifications`,
          `Paste this base into every call-event URL field your phone exposes:`,
          ``,
          `   ${actionBase}?event={EVENT}&mac={MAC}&remote={CALLER}&local={CALLEE}&duration={DURATION}`,
          ``,
          `Replace {EVENT} with: incoming | outgoing | connected | disconnected | missed`,
          `Replace {MAC},{CALLER},{CALLEE},{DURATION} with your phone's variable syntax`,
          `  Yealink:     $mac $remote $local $duration`,
          `  Grandstream: %MAC% %CALLER_NUM% %CALLED_NUM% %DURATION%`,
          `  Cisco/Polycom: see vendor docs`,
          ``,
          dev.ringtone_url ? `## 3. Custom Ringtone\n${esc(dev.ringtone_url)}\n` : ``,
        ].join("\n");
        return new Response(generic, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      },
    },
  },
});
