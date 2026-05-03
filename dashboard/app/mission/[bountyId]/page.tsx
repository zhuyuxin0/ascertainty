import { redirect } from "next/navigation";

// Old dusk-theme race / mission control. Live race state now surfaces
// inside /atlas (cosmos field). The cream-paper claim proceedings live
// at /bounty/[bountyId] and are linked from there. Redirect old mission
// links to the proceedings so visitors don't land on a stale dark
// surface.
export default async function MissionRedirect({
  params,
}: {
  params: Promise<{ bountyId: string }>;
}) {
  const { bountyId } = await params;
  redirect(`/bounty/${encodeURIComponent(bountyId)}`);
}
