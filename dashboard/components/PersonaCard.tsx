type Persona = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
  profile: string;
  axiom_breadth: number;
  address: string | null;
  token_id: number | null;
  storage_root_hash: string | null;
  descriptor: string | null;
  version: string | null;
  minted_at: number | null;
  reputation: number;
  solved_count: number;
};

const EXPLORER = "https://chainscan-galileo.0g.ai";

export function PersonaCard({ persona }: { persona: Persona }) {
  const breadthPct = Math.round((persona.axiom_breadth / 6) * 100);
  return (
    <a
      href={persona.address ? `${EXPLORER}/address/${persona.address}` : "#"}
      target={persona.address ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="border bg-bg/60 backdrop-blur p-5 flex flex-col gap-3 hover:bg-bg/90 transition-colors group relative overflow-hidden"
      style={{ borderColor: persona.color }}
    >
      {/* corner glyph */}
      <div
        className="absolute -top-2 -right-2 text-7xl opacity-20 group-hover:opacity-30 transition-opacity"
        aria-hidden
      >
        {persona.emoji}
      </div>

      <div className="flex items-start justify-between relative">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            persona iNFT{persona.token_id !== null ? ` · #${persona.token_id}` : ""}
          </div>
          <div
            className="font-sans text-2xl font-light mt-0.5"
            style={{ color: persona.color }}
          >
            {persona.name}
          </div>
          <div className="font-mono text-[10px] text-white/60 mt-0.5">
            {persona.tagline}
          </div>
        </div>
      </div>

      {/* Axiom breadth bar */}
      <div className="relative">
        <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1">
          axiom whitelist breadth
        </div>
        <div className="h-1 bg-line">
          <div
            className="h-full transition-all"
            style={{ width: `${breadthPct}%`, background: persona.color }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-1 relative">
        <Stat label="reputation" value={persona.reputation.toString()} color={persona.color} />
        <Stat label="solved" value={persona.solved_count.toString()} color={persona.color} />
        <Stat label="profile" value={persona.profile} color={persona.color} />
      </div>

      {/* Footer: address + descriptor */}
      <div className="border-t border-line/50 pt-3 mt-1 relative">
        <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
          address
        </div>
        <div className="font-mono text-[10px] text-white/85 truncate">
          {persona.address ? short(persona.address, 10, 8) : "—"}
        </div>
        {persona.descriptor && (
          <>
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-2">
              model descriptor
            </div>
            <div className="font-mono text-[10px] text-white/70 truncate">
              {persona.descriptor}
            </div>
          </>
        )}
      </div>
    </a>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className="font-mono text-sm" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function short(s: string, head = 6, tail = 4): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
