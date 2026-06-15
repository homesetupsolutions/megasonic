import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listOrgs, updateOrgSquare } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const orgsFn = useServerFn(listOrgs);
  const updateFn = useServerFn(updateOrgSquare);
  const { data: orgs } = useQuery<any[]>({ queryKey: ["orgs"], queryFn: () => orgsFn() as any });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Square POS sync per organization.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Square access</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>To sync prices to Square POS, MagaSonic needs a Square access token stored as a backend secret named <code>SQUARE_ACCESS_TOKEN</code>.</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Go to <a className="underline" href="https://developer.squareup.com/apps" target="_blank" rel="noreferrer">developer.squareup.com/apps</a> and sign in with your Square account.</li>
            <li>Click <b>+</b> to create an app called "MagaSonic".</li>
            <li>Open the app → <b>Production</b> tab (use Sandbox for testing) → <b>Credentials</b>.</li>
            <li>Copy the <b>Production Access Token</b>.</li>
            <li>In <b>Locations</b>, copy the <b>Location ID</b> of the store you want to sync.</li>
            <li>Paste the access token when MagaSonic asks (top of chat). Paste the location ID below.</li>
          </ol>
        </CardContent>
      </Card>

      {orgs?.map((o) => (
        <OrgSquareCard key={o.id} org={o} onSave={(patch) =>
          updateFn({ data: { id: o.id, ...patch } }).then(() => {
            toast.success("Saved");
            qc.invalidateQueries({ queryKey: ["orgs"] });
          }).catch((e) => toast.error(e.message))
        } />
      ))}
    </div>
  );
}

function OrgSquareCard({ org, onSave }: { org: any; onSave: (p: any) => void }) {
  const [loc, setLoc] = useState(org.square_location_id ?? "");
  const [enabled, setEnabled] = useState(!!org.square_enabled);
  useEffect(() => { setLoc(org.square_location_id ?? ""); setEnabled(!!org.square_enabled); }, [org.id]);
  return (
    <Card>
      <CardHeader><CardTitle>{org.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Square Location ID</Label>
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="L1234ABCDEFGH" />
        </div>
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            Sync approved changes to Square for this org
          </Label>
          <Button onClick={() => onSave({ square_location_id: loc || null, square_enabled: enabled })}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}
