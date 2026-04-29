/** Shared types for atlas data fetched from /atlas/* endpoints. */

export type AtlasModel = {
  model_id: string;
  name: string;
  provider: string;
  family: string;
  mmlu: number | null;
  gpqa: number | null;
  humaneval: number | null;
  math: number | null;
  arc: number | null;
  aggregate: number;
  last_updated_unix: number;
  price_input_mtok: number | null;
  price_output_mtok: number | null;
  source_url: string;
  layout_x: number | null;
  layout_y: number | null;
};

export type AtlasMarket = {
  market_id: string;
  slug: string;
  question: string;
  probability: number;
  volume_usd: number;
  category: string;
  end_date_iso: string;
  last_updated: number;
  layout_x: number | null;
  layout_y: number | null;
};

export type AtlasConnection = {
  market_id: string;
  model_id: string;
};

export type AtlasResponse<T> = { count: number } & Record<string, unknown> & {
  models?: T[];
  markets?: T[];
  connections?: T[];
};

export const BENCHMARKS = ["mmlu", "gpqa", "humaneval", "math", "arc"] as const;
export type BenchmarkKey = (typeof BENCHMARKS)[number];

export const BENCHMARK_LABEL: Record<BenchmarkKey, string> = {
  mmlu: "MMLU",
  gpqa: "GPQA",
  humaneval: "HumanEval",
  math: "MATH",
  arc: "ARC",
};

export const PROVIDER_COLOR: Record<string, [number, number, number]> = {
  OpenAI: [16, 163, 127],
  Anthropic: [204, 120, 92],
  Google: [66, 133, 244],
  Meta: [24, 119, 242],
  DeepSeek: [94, 63, 196],
  Mistral: [250, 82, 15],
  xAI: [29, 161, 242],
  Alibaba: [255, 106, 0],
  Cohere: [57, 206, 155],
  "Open-source": [136, 136, 136],
};

export function providerColorRGB(provider: string): [number, number, number] {
  return PROVIDER_COLOR[provider] ?? [136, 136, 136];
}
