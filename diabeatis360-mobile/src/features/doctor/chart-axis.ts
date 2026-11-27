// The y axis of the doctor's 7-day line charts (week-line-chart.tsx). No app imports, so plain Node can test it
// (chart-axis.test.mjs).

/**
 * A round axis for the values: about three steps of 1, 2 or 5 × 10ⁿ. `fromZero` starts at 0 (money); otherwise it
 * starts at a round number just under the lowest value, like the frame's 80–140 mg/dL, so a week of readings close
 * together still shows its shape.
 */
export function niceAxis(values: number[], fromZero: boolean) {
  const low = fromZero || values.length === 0 ? 0 : Math.min(...values);
  const high = values.length === 0 ? 0 : Math.max(...values);
  const span = high - low || (fromZero ? 1000 : 40);
  const raw = span / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw) ?? 10 * magnitude;
  const bottom = Math.max(0, Math.floor(low / step) * step);
  let top = Math.ceil(high / step) * step;
  if (top <= bottom) top = bottom + step;
  const ticks: number[] = [];
  for (let value = bottom; value <= top + step / 2; value += step) ticks.push(Math.round(value));
  return { bottom, top, ticks };
}
