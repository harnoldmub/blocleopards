/**
 * Calcul du transfert de peau (plus proches voisins sur une grille), pur et sans DOM :
 * exécuté dans un Web Worker pour ne jamais bloquer l'écran tactile.
 */
export interface SkinInput {
  n: number;
  /** Positions de recherche de la joueuse (n*3). */
  search: Float32Array;
  /** Classes d'os autorisées par sommet (bit 0 tronc, 1 bras, 2 jambes). */
  allow: Uint8Array;
  /** Côté imposé (jambes, bras) : -1, 1, ou 0 sans contrainte. */
  side: Int8Array;
  /** Sommets du joueur (m*3), classe dominante, os et poids (m*4). */
  mx: Float32Array;
  vClass: Uint8Array;
  mSkI: Uint16Array;
  mSkW: Float32Array;
  remap: Int16Array;
  cell: number;
  latAxis: number;
  latC: number;
}

export function computeSkin(inp: SkinInput): { skI: Uint16Array; skW: Float32Array } {
  const { n, search, allow, side, mx, vClass, mSkI, mSkW, remap, cell, latAxis, latC } = inp;
  const m = mx.length / 3;
  const OFF = 512;
  const key = (x: number, y: number, z: number) => ((x + OFF) * 1024 + (y + OFF)) * 1024 + (z + OFF);
  const grid = new Map<number, number[]>();
  for (let j = 0; j < m; j++) {
    const k = key(Math.floor(mx[j * 3] / cell), Math.floor(mx[j * 3 + 1] / cell), Math.floor(mx[j * 3 + 2] / cell));
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(j);
  }
  const skI = new Uint16Array(n * 4);
  const skW = new Float32Array(n * 4);
  const bestJ = new Int32Array(4);
  const bestD = new Float64Array(4);
  const accB = new Int32Array(16);
  const accW = new Float64Array(16);
  for (let i = 0; i < n; i++) {
    const sx = search[i * 3];
    const sy = search[i * 3 + 1];
    const sz = search[i * 3 + 2];
    const mask = allow[i];
    const sd = side[i];
    const cx = Math.floor(sx / cell);
    const cy = Math.floor(sy / cell);
    const cz = Math.floor(sz / cell);
    let found = 0;
    for (let r = 1; r <= 10 && found < 4; r++) {
      found = 0;
      bestD.fill(Infinity);
      bestJ.fill(-1);
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          for (let c = -r; c <= r; c++) {
            const arr = grid.get(key(cx + a, cy + b, cz + c));
            if (!arr) continue;
            for (let q = 0; q < arr.length; q++) {
              const j = arr[q];
              if (!((mask >> vClass[j]) & 1)) continue;
              if (sd !== 0 && Math.sign(mx[j * 3 + latAxis] - latC) !== sd) continue;
              const dx = mx[j * 3] - sx;
              const dy = mx[j * 3 + 1] - sy;
              const dz = mx[j * 3 + 2] - sz;
              const d = dx * dx + dy * dy + dz * dz;
              found++;
              // insertion dans les 4 meilleurs
              if (d < bestD[3]) {
                let p = 3;
                while (p > 0 && bestD[p - 1] > d) {
                  bestD[p] = bestD[p - 1];
                  bestJ[p] = bestJ[p - 1];
                  p--;
                }
                bestD[p] = d;
                bestJ[p] = j;
              }
            }
          }
    }
    let na = 0;
    for (let t = 0; t < 4; t++) {
      const j = bestJ[t];
      if (j < 0) continue;
      const w = 1 / (Math.sqrt(bestD[t]) + cell * 0.05) ** 2;
      for (let c = 0; c < 4; c++) {
        const bw = mSkW[j * 4 + c];
        if (bw <= 0) continue;
        const b0 = mSkI[j * 4 + c];
        const bi = remap[b0] >= 0 ? remap[b0] : b0;
        let slot = -1;
        for (let s = 0; s < na; s++) if (accB[s] === bi) slot = s;
        if (slot < 0 && na < 16) {
          slot = na++;
          accB[slot] = bi;
          accW[slot] = 0;
        }
        if (slot >= 0) accW[slot] += bw * w;
      }
    }
    // 4 os les plus lourds, normalisés
    let sum = 0;
    for (let c = 0; c < 4; c++) {
      let bs = -1;
      for (let s = 0; s < na; s++) if (accW[s] > 0 && (bs < 0 || accW[s] > accW[bs])) bs = s;
      if (bs < 0) break;
      skI[i * 4 + c] = accB[bs];
      skW[i * 4 + c] = accW[bs];
      sum += accW[bs];
      accW[bs] = -1;
    }
    if (sum > 0) for (let c = 0; c < 4; c++) skW[i * 4 + c] /= sum;
    else skW[i * 4] = 1;
  }
  return { skI, skW };
}
