import pricing from '../../config/pricing.json' with { type: 'json' };
export function estimate(model: string, usage: Record<string, any>): number | null {
  let rate: any;
  if (model === 'claude-opus-5-5') rate = pricing[model];
  if (model === 'claude-haiku-5-5')
    rate =
      pricing[model][
        (usage.input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0) >
        100000
          ? 'long'
          : 'short'
      ];
  if (!rate) return null;
  const writes = usage.cache_creation ?? {};
  const oneHour = writes.ephemeral_1h_input_tokens ?? 0,
    fiveMin =
      writes.ephemeral_5m_input_tokens ??
      Math.max(0, (usage.cache_creation_input_tokens ?? 0) - oneHour);
  return (
    (((usage.input_tokens ?? 0) * rate.input +
      (usage.output_tokens ?? 0) * rate.output +
      (usage.cache_read_input_tokens ?? 0) * rate.cacheRead +
      fiveMin * rate.cacheWrite5m +
      oneHour * rate.cacheWrite1h) /
      1e6) *
    (usage.inference_geo === 'us' ? 1.1 : 1)
  );
}
