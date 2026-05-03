import { redirect } from "next/navigation";

// Old dusk-theme route. Bounty browsing now lives inside /atlas (header
// → bounties slide-over). Redirected so visitors don't land on a stale
// dark surface that conflicts with the cream-paper identity.
export default function BountiesRedirect() {
  redirect("/atlas?panel=bounties");
}
