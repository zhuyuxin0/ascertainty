/* DetailView — band 4. The deepest zoom: a single bounty rendered as a
 * proceedings card with statement + Lean kernel block + payout figure.
 *
 * Phase 2-5 uses the canonical "prime-gap lemma" sample from the design
 * reference. Phase 6 wires this to the selected bounty from /bounties
 * so detail-band shows whatever entity-band the user clicked into. */

export function DetailView() {
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill="rgba(250,246,232,0.95)" />
      <g transform="translate(800, 450)">
        <text
          y={-280}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill="rgba(10,21,37,0.46)"
          letterSpacing={3}
        >
          AI MODELS · LLM · CLAUDE-SONNET-4.5 · BOUNTY ⁄00291
        </text>
        <text
          y={-220}
          textAnchor="middle"
          fontFamily="var(--font-instrument-serif), serif"
          fontSize={38}
          fontStyle="italic"
          fill="rgba(10,21,37,0.94)"
        >
          prime-gap lemma — settle by kernel.
        </text>
        <text
          y={-188}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill="#1F8FA8"
          letterSpacing={3}
        >
          DETAIL · SETTLED · 94% CONFIDENCE
        </text>

        {/* Statement + kernel card */}
        <g transform="translate(-280, -100)">
          <rect width={560} height={260} fill="#FDFAEE" stroke="rgba(10,21,37,0.18)" strokeWidth={1} />
          <text x={24} y={36} fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill="rgba(10,21,37,0.46)" letterSpacing={2.5}>
            ¶ STATEMENT
          </text>
          <text x={24} y={68} fontFamily="var(--font-instrument-serif), serif" fontSize={22} fill="rgba(10,21,37,0.94)">
            For all primes p &gt; N₀, the gap g(p)
          </text>
          <text x={24} y={94} fontFamily="var(--font-instrument-serif), serif" fontSize={22} fill="rgba(10,21,37,0.94)">
            satisfies g(p) ≤ c · log(p)².
          </text>
          <line x1={24} y1={124} x2={536} y2={124} stroke="rgba(10,21,37,0.12)" />
          <text x={24} y={152} fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill="rgba(10,21,37,0.46)" letterSpacing={2.5}>
            ¶ KERNEL
          </text>
          <text x={24} y={176} fontFamily="var(--font-jetbrains-mono), monospace" fontSize={13} fill="rgba(10,21,37,0.84)">
            theorem prime_gap_bound :
          </text>
          <text x={24} y={196} fontFamily="var(--font-jetbrains-mono), monospace" fontSize={13} fill="rgba(10,21,37,0.84)">
            ∀ p, p.prime → ∃ c, gap p ≤ c * (log p)^2 := by
          </text>
          <text x={24} y={216} fontFamily="var(--font-jetbrains-mono), monospace" fontSize={13} fill="rgba(10,21,37,0.84)">
            intro p hp; exact ⟨C, prime_gap_log_sq hp⟩
          </text>
          <text x={24} y={244} fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill="#1F8FA8" letterSpacing={2.5}>
            ✓ LEAN v4.10 · KERNEL ACCEPTED
          </text>
        </g>

        {/* Payout */}
        <g transform="translate(-280, 180)">
          <text x={0} y={0} fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill="rgba(10,21,37,0.46)" letterSpacing={2.5}>
            ¶ PAYOUT
          </text>
          <text x={0} y={30} fontFamily="var(--font-instrument-serif), serif" fontSize={32} fill="#1F8FA8">
            Ⓧ 1,247
          </text>
        </g>
      </g>
    </g>
  );
}
