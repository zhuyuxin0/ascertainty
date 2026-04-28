import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import { MissionControl } from "@/components/MissionControl";
import { API_URL, type Bounty, type Submission } from "@/lib/api";

export const dynamic = "force-dynamic";

type StatusResp = {
  bounty: Bounty;
  submissions: Submission[];
};

async function loadBounty(id: number): Promise<StatusResp | null> {
  try {
    const res = await fetch(`${API_URL}/bounty/${id}/status`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as StatusResp;
  } catch {
    return null;
  }
}

async function loadPersonas() {
  try {
    const res = await fetch(`${API_URL}/agent/personas`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function MissionPage({
  params,
}: {
  params: { bountyId: string };
}) {
  const id = parseInt(params.bountyId, 10);
  if (Number.isNaN(id)) notFound();
  const [data, personas] = await Promise.all([loadBounty(id), loadPersonas()]);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-grid">
      <Header active="bounties" />
      <MissionControl
        bounty={data.bounty}
        submissions={data.submissions}
        personas={personas?.personas ?? []}
      />
    </main>
  );
}
