import { redirect } from "next/navigation";

// Old dusk-theme route. Agent status now lives inside /atlas (header brand
// chip → agent slide-over). Redirected so visitors don't land on a stale
// dark surface that conflicts with the cream-paper identity.
export default function AgentRedirect() {
  redirect("/atlas?panel=agent");
}
