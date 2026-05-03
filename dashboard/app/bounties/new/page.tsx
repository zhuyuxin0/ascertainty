import { redirect } from "next/navigation";

// Old dusk-theme route. Bounty minting is being rebuilt as a cream-paper
// flow inside /atlas. Until that ships, redirect so visitors don't land
// on a stale dark surface that conflicts with the current identity.
export default function BountiesNewRedirect() {
  redirect("/atlas?panel=bounties");
}
