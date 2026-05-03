/* AS-CERTAIN-TY — the brand's letterform mechanic.
 *
 * The name is the design system:
 *
 *   AS-prefix:  the letter S after A becomes the START of a contextual
 *               word — Stop / Studio / Strategy / Symposium / STEM /
 *               Story — that re-frames the platform per audience. Auto-
 *               cycles every 1.8s; hover the S to see the gloss.
 *
 *   CERTAIN:    each letter maps to a product principle. Hover any of
 *               C-E-R-T-A-I-N to reveal it.
 *
 *   TY-suffix:  "to you" — the platform is plural-stakeholder; the AS
 *               extension changes for each.
 *
 * One source of truth shared by the dramatic /atlas overlay (dark field)
 * and the new landing hero (cream paper field). Adding a new audience
 * extension or refining a CERTAIN principle should be a single edit
 * here, not a hunt across components.
 */

export const CERTAIN_MEANINGS: Record<string, { word: string; gloss: string }> = {
  C: { word: "Claims", gloss: "every node is a verifiable claim" },
  E: { word: "Evidence", gloss: "zoom deeper to see what backs it" },
  R: {
    word: "Resolution",
    gloss: "kernel-checked, TEE-attested, or consensus-resolved",
  },
  T: { word: "Tradeable", gloss: "every region can be staked on" },
  A: { word: "Agents", gloss: "spotters, solvers, spectators" },
  I: { word: "Information depth", gloss: "irreducible structure, layer by layer" },
  N: { word: "Navigable", gloss: "explored, not listed" },
};

export type AsExtension = {
  /** The letters that follow the lead "S" to form the full word.
   *  Example: tail "TUDIO" + the S → "Studio". */
  tail: string;
  /** The full word (S + tail), display-friendly. */
  word: string;
  /** The one-line meaning the audience would read. */
  gloss: string;
  /** Which stakeholder this framing speaks to. */
  audience: string;
};

export const AS_EXTENSIONS: AsExtension[] = [
  { tail: "TOP", word: "Stop", gloss: "a place to pause, examine, verify before acting", audience: "for the analyst" },
  { tail: "TUDIO", word: "Studio", gloss: "a creative workspace for building knowledge agents", audience: "for the spotter" },
  { tail: "TRATEGY", word: "Strategy", gloss: "a decision framework grounded in verified information", audience: "for the operator" },
  { tail: "YMPOSIUM", word: "Symposium", gloss: "a gathering place for solvers, spotters, spectators", audience: "for the community" },
  { tail: "TEM", word: "STEM", gloss: "a scientific instrument for navigating knowledge", audience: "for the researcher" },
  { tail: "TORY", word: "Story", gloss: "a narrative that unfolds as you zoom deeper", audience: "for the spectator" },
];

/** Position constants for the AS-CERTAIN-TY letterform. */
export const ASCERTAINTY_LETTERS = "ASCERTAINTY".split("");
/** Indices into ASCERTAINTY_LETTERS that form CERTAIN: C=2, E=3, R=4, T=5, A=6, I=7, N=8. */
export const CERTAIN_RANGE: [number, number] = [2, 8];
/** Index of the contextual "S" that auto-cycles through AS_EXTENSIONS. */
export const S_INDEX = 1;
