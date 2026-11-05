/** Squarified treemap layout (Bruls et al.). Returns rectangles in percent of the container. */
export interface TreemapRect {
  x: number
  y: number
  w: number
  h: number
}

export function squarify(values: number[], width = 100, height = 100): TreemapRect[] {
  const total = values.reduce((a, b) => a + b, 0)
  const order = values
    .map((v, i) => ({ v: (v / total) * width * height, i }))
    .sort((a, b) => b.v - a.v)
  const out: TreemapRect[] = new Array(values.length)
  let x = 0
  let y = 0
  let w = width
  let h = height
  let row: { v: number; i: number }[] = []

  const worst = (r: { v: number }[], side: number) => {
    const s = r.reduce((a, b) => a + b.v, 0)
    const max = Math.max(...r.map((e) => e.v))
    const min = Math.min(...r.map((e) => e.v))
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min))
  }
  const layoutRow = (r: { v: number; i: number }[]) => {
    const s = r.reduce((a, b) => a + b.v, 0)
    if (w >= h) {
      const rw = s / h
      let yy = y
      for (const e of r) {
        const eh = e.v / rw
        out[e.i] = { x, y: yy, w: rw, h: eh }
        yy += eh
      }
      x += rw
      w -= rw
    } else {
      const rh = s / w
      let xx = x
      for (const e of r) {
        const ew = e.v / rh
        out[e.i] = { x: xx, y, w: ew, h: rh }
        xx += ew
      }
      y += rh
      h -= rh
    }
  }

  for (const e of order) {
    const side = Math.min(w, h)
    if (!row.length || worst([...row, e], side) <= worst(row, side)) row.push(e)
    else {
      layoutRow(row)
      row = [e]
    }
  }
  if (row.length) layoutRow(row)
  return out
}
