import { redirect } from "next/navigation";

export default function HomePage() {
  // The cosmos atlas is the new front door. /bounties, /agent, /mission/[id]
  // remain accessible as deep-zoom destinations from inside the atlas.
  redirect("/atlas");
}
