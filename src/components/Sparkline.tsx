const WIDTH = 80;
const HEIGHT = 24;

/** The points of a small line, scaled so the highest value nearly reaches the top. */
export function sparkPoints(values: readonly number[]): string {
  const highest = Math.max(...values, 1);
  const last = Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      const x = 2 + (index / last) * (WIDTH - 4);
      const y = HEIGHT - 3 - (value / highest) * (HEIGHT - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** A small trend line beside a number. Decoration only: the number says the value. */
export function Sparkline({ values }: { values: readonly number[] | undefined }) {
  return (
    <svg
      aria-hidden="true"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ flex: 'none' }}
    >
      {values && (
        <polyline
          points={sparkPoints(values)}
          fill="none"
          stroke="var(--green-ink)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
