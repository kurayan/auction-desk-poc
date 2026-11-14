export const visibleCandidates=items=>items.filter(c=>Number.isFinite(c.spread)).sort((a,b)=>b.spread-a.spread).slice(0,5);
