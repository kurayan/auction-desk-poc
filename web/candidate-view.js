export const visibleCandidates=items=>items.filter(c=>Number.isFinite(c.spread)&&c.spread>=0).sort((a,b)=>b.spread-a.spread);
