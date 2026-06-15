import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: () => <ComingSoon title="Inventory" desc="Coming in phase 3. Inventory events from feelbasspos already land via hub.inventory()." />,
});
