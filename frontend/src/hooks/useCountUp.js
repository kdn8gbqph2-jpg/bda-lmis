/**
 * useCountUp — animate an integer from 0 (or `from`) to `target` over
 * `duration` ms using requestAnimationFrame. Ease-out curve so it slows
 * naturally at the end; restarts when `target` changes.
 *
 * Used on KPI / category cards across the public dashboard so the
 * counts feel "loaded in" rather than appearing instantly.
 */

import { useEffect, useState } from 'react'

const easeOut = (t) => 1 - Math.pow(1 - t, 3)

export function useCountUp(target, { duration = 700, from = 0 } = {}) {
  const [value, setValue] = useState(from)

  useEffect(() => {
    if (target == null) return
    let raf = 0
    let start = 0

    const tick = (ts) => {
      if (!start) start = ts
      const t = Math.min(1, (ts - start) / duration)
      setValue(Math.round(from + (target - from) * easeOut(t)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, from])

  return value
}
