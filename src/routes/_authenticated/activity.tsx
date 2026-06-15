import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/activity")({
  component: () => <ComingSoon title="Activity log" desc="Coming in phase 2. Until then, the Unified Feed shows raw events." />,
});
