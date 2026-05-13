/**
 * Backdrop — the single visual base used across every public + staff
 * surface of the portal. One source of truth so the gradient + grid
 * texture stay identical between Dashboard, Colonies, Login, etc.
 *
 * Composition (always rendered as two absolutely-positioned layers):
 *   1. Soft three-stop gradient: blue-50 → white → slate-50.
 *   2. Faint coordinate-grid texture (linear gradients), evokes a
 *      GIS surface without becoming visual noise. 4% opacity by
 *      default; `subtle` drops it to 2.5% for tighter containers
 *      like the sidebar brand band.
 *
 * Usage:
 *   <section className="relative overflow-hidden">
 *     <Backdrop />
 *     <div className="relative ...">…content…</div>
 *   </section>
 *
 * The parent MUST be positioned (relative / absolute) and the
 * content must sit in a `relative` child so it stacks above the
 * backdrop layers.
 */

export function Backdrop({ subtle = false, gridSize = 32 }) {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-slate-50"
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            `linear-gradient(#0f172a 1px, transparent 1px),
             linear-gradient(90deg, #0f172a 1px, transparent 1px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          opacity: subtle ? 0.025 : 0.04,
        }}
      />
    </>
  )
}
