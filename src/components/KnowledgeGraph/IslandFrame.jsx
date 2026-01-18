export default function IslandFrame({ island, children }) {
  return (
    <div
      className="absolute rounded-[28px] border border-black/5 bg-white"
      style={{
        left: island.x,
        top: island.y,
        width: island.width,
        height: island.height,
      }}
    >
      <p className="absolute left-6 top-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
        {island.title}
      </p>
      {children}
    </div>
  )
}
