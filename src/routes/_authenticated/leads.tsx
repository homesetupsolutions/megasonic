import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/leads")({
  component: () => <ComingSoon title="Leads / CRM" desc="Coming in phase 2. Leads sent via hub.lead() already land in the database." />,
});
