import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/manual")({ component: ManualPage });

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Sign in",
    body: [
      "Open MagaSonic and tap Continue with Google. Only the owner's Google account can sign in.",
      "Once in, you'll land on the Dashboard. The left sidebar lists everything.",
    ],
  },
  {
    title: "2. The 🛸 Alien (ET) — your assistant",
    body: [
      "Tap 🛸 Alien in the sidebar to open ET's full screen.",
      "Type a question in the chat or use the phone-lookup box to load a caller by number.",
      "ET grows from egg → adult by earning XP from your actions. It rebirths into a new species on the 1st of every month.",
    ],
  },
  {
    title: "3. Quick Book a customer in 30 seconds",
    body: [
      "Sidebar → Quick Book. 4 steps: pick org → pick service → enter name+phone+time → optional card on file.",
      "If they cancel within 24h or no-show, a $45 cancellation fee is auto-charged to the saved Square card.",
    ],
  },
  {
    title: "4. Services & pricing — change once, update everywhere",
    body: [
      "Sidebar → Services & Pricing. Edit any service. Your change becomes an Approval Request (not live yet).",
      "Sidebar → Approvals to review and approve. Approval pushes the price to Square AND broadcasts to every linked website (FeelBass VIP, FeelBass POS, HomeSetupSolutions, FeelTheCity).",
      "Pending requests auto-expire after 7 days. Max 50 pending at any time.",
    ],
  },
  {
    title: "5. Bookings",
    body: [
      "Sidebar → Bookings. See everything, change status, add card on file.",
      "Status changes to Cancelled or No-show trigger the auto-fee.",
    ],
  },
  {
    title: "6. AI calls & call scripts",
    body: [
      "Sidebar → Call Scripts. Tap Practice on any script to click through every possible customer reply.",
      "Sidebar → AI Calls to see calls ET answered, with proposed bookings waiting for your approval.",
    ],
  },
  {
    title: "7. Desk phones, SIP trunks & IVR voice",
    body: [
      "Sidebar → Desk Phones to register a Yealink/Grandstream by MAC. Copy the provisioning URL into the phone.",
      "Sidebar → SIP Trunks to map each CallCentric DID to a route (IVR / straight to ET / extension / voicemail) and pick a voice.",
      "Sidebar → IVR Designer for advanced menu trees, schedules, paging groups, and the reception display.",
    ],
  },
  {
    title: "8. Daily reminders",
    body: [
      "Sidebar → AI Strategist → set reminder hour and lead time. Every day at that hour, ET drafts reminders for every booking in the window.",
      "They appear as click-to-dial / draft-SMS / draft-email tasks. You approve, then send.",
    ],
  },
  {
    title: "9. Linking other Lovable projects",
    body: [
      "Sidebar → Projects. Use Quick-add to bulk-add your 4 sites. Each gets an API key.",
      "Paste the snippet into the other Lovable app to fetch a full snapshot via magasonic.all().",
    ],
  },
  {
    title: "10. When something looks broken",
    body: [
      "Sidebar → Activity to see the latest system events.",
      "Sidebar → Connections for the status of Square, Google, CallCentric and other integrations.",
      "If a price didn't push out, open Approvals — it might be pending.",
    ],
  },
  {
    title: "11. Mobile (Samsung)",
    body: [
      "Open the published URL in Chrome → menu → Add to Home screen. It installs as a PWA.",
      "Allow notifications when prompted to receive booking-approval pings.",
    ],
  },
];

function ManualPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen /> How-to-use Manual</h1>
        <p className="text-muted-foreground">Written for a 10-year-old. Tap a step and follow it.</p>
      </div>
      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <CardHeader><CardTitle>{s.title}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {s.body.map((p, i) => <p key={i}>{p}</p>)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
