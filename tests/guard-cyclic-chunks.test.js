import test from 'node:test';
import assert from 'node:assert/strict';
import { findChunkCycle, blockCyclicProductionChunks } from '../build/guard-cyclic-chunks.js';

test('original iFund guard permits acyclic production chunks and external imports', () => {
  assert.equal(findChunkCycle([{fileName:'a.js',imports:['b.js','react']},{fileName:'b.js',imports:[]}]),null);
});

test('original iFund guard rejects a cycle across emitted chunks', () => {
  assert.deepEqual(findChunkCycle([{fileName:'a.js',imports:['b.js']},{fileName:'b.js',imports:['c.js']},{fileName:'c.js',imports:['a.js']}]),['a.js','b.js','c.js','a.js']);
});

test('plugin fails build on cyclic chunk graph', () => {
  const plugin=blockCyclicProductionChunks();
  assert.equal(plugin.apply,'build');
  assert.throws(()=>plugin.generateBundle.call({error(message){throw Error(message)}},null,{
    a:{type:'chunk',fileName:'a.js',imports:['b.js']},b:{type:'chunk',fileName:'b.js',imports:['a.js']},asset:{type:'asset',fileName:'logo.png'}
  }),/circular JavaScript chunk import a.js -> b.js -> a.js/);
});
