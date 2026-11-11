/** Logo ChainMesh: graf lengkap K₄ (4 vertex, 6 edge). */
export function Logo({ className = 'w-7 h-7' }: { className?: string }) {
  const points = [
    [8, 8],
    [24, 8],
    [24, 24],
    [8, 24],
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3],
  ];
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={points[a][0]}
          y1={points[a][1]}
          x2={points[b][0]}
          y2={points[b][1]}
          stroke={i >= 4 ? '#FFA200' : '#FF5500'}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.4" fill="#FAF5F0" stroke="#FF5500" strokeWidth="1.8" />
      ))}
    </svg>
  );
}
