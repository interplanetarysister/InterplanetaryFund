// Keep original iFund's production bundle invariant during frontend restoration.
// A cyclic import between emitted chunks can leave the app blank at startup.
export function findChunkCycle(chunks) {
  const graph = new Map(chunks.map(chunk => [chunk.fileName, chunk.imports.filter(name => chunks.some(c => c.fileName === name))]));
  const settled = new Set();
  const active = [];
  const visit = (name) => {
    const at = active.indexOf(name);
    if (at >= 0) return active.slice(at).concat(name);
    if (settled.has(name)) return null;
    active.push(name);
    for (const dependency of graph.get(name) || []) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    active.pop();
    settled.add(name);
    return null;
  };
  for (const name of graph.keys()) {
    const cycle = visit(name);
    if (cycle) return cycle;
  }
  return null;
}

export function blockCyclicProductionChunks() {
  return {
    name: 'ifund-block-cyclic-production-chunks',
    apply: 'build',
    generateBundle(_options, bundle) {
      const cycle = findChunkCycle(Object.values(bundle).filter(asset => asset.type === 'chunk'));
      if (cycle) this.error('IFund build blocked: circular JavaScript chunk import ' + cycle.join(' -> '));
    },
  };
}
