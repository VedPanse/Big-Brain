export default function Edge({ from, to, isHighlighted, isDimmed }) {
  const stroke = isHighlighted ? 'rgba(56,189,248,0.7)' : 'rgba(148,163,184,0.6)'
  const opacity = isDimmed ? 0.2 : 1
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={stroke}
      strokeWidth={1}
      opacity={opacity}
    />
  )
}
