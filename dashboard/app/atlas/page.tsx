/* /atlas — v3 cream-paper cartographic plate.
 *
 * Replaces the v2 Three.js cosmos. The page is a thin server-component
 * mount; everything else (state, interactions, panels, overlays) lives
 * inside <AtlasShell> which is a client component subscribing to the
 * Zustand store at lib/atlas-v3/state.ts.
 *
 * The 3D Three.js scene + 16 atlas-v2 components have been retired
 * (see commit history under "Atlas v3" for the migration). The
 * /lib/atlas/regions.ts + /lib/atlas/zoomLevels.ts vestigials remain
 * temporarily for type-only imports elsewhere; they'll be deleted in
 * the final cleanup pass once nothing imports them. */

import { AtlasShell } from "@/components/atlas-v3/AtlasShell";

export default function AtlasPage() {
  return <AtlasShell />;
}
