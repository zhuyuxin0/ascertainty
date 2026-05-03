import { redirect } from "next/navigation";

// Old dusk-theme route. Solver standings now surface inside /atlas
// (provers band + persona detail panel). Redirected so visitors don't
// land on a stale dark surface.
export default function LeaderboardRedirect() {
  redirect("/atlas");
}
