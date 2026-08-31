import { readFile } from 'node:fs/promises';

const sources = JSON.parse(await readFile(new URL('../src/site/vod.json', import.meta.url), 'utf8'));
const enabled = sources.filter(source => source.isEnabled !== false);

const results = await Promise.all(enabled.map(async source => {
  const url = new URL(source.url);
  url.searchParams.set('ac', 'list');
  url.searchParams.set('pg', '1');
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json();
    return {
      id: source.id,
      name: source.name,
      status: response.ok && data.code == 1 && Array.isArray(data.list) ? 'ok' : 'invalid',
      items: Array.isArray(data.list) ? data.list.length : 0,
      latency: `${Date.now() - startedAt}ms`,
    };
  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      status: 'failed',
      items: 0,
      latency: `${Date.now() - startedAt}ms`,
    };
  }
}));

console.table(results);
const healthy = results.filter(result => result.status === 'ok').length;
console.log(`${healthy}/${results.length} enabled sources returned valid MacCMS JSON.`);
