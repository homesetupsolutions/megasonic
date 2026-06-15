import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => <ComingSoon title="Settings" desc="Profile, integration keys, and team access — coming in phase 3." />,
});
