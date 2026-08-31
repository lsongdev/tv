import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('../public/', import.meta.url);
const source = new URL('../src/site/', import.meta.url);
const assets = [
  'index.html',
  'index.css',
  'index.js',
  'client.js',
  'vod.json',
  'manifest.json',
  '_headers',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(assets.map(file => cp(new URL(file, source), new URL(file, output))));
