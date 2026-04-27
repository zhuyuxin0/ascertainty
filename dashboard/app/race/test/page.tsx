import RaceCanvas from "@/components/RaceCanvas";
import Link from "next/link";

export default function RaceTestPage() {
  return (
    <main className="relative h-screen overflow-hidden">
      <RaceCanvas className="absolute inset-0" />

      <div className="absolute top-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between pointer-events-none">
        <Link href="/" className="font-mono text-xs uppercase tracking-widest text-white/60 hover:text-cyan pointer-events-auto">
          ← ascertainty
        </Link>
        <div className="font-mono text-xs uppercase tracking-widest text-cyan/80">
          race / test
        </div>
      </div>

      <div className="absolute bottom-6 left-6 z-10 font-mono text-[10px] text-white/40 leading-tight pointer-events-none">
        <div>WASD / arrows: drive</div>
        <div>SPACE: brake</div>
      </div>
    </main>
  );
}
