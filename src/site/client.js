const DEFAULT_PROXY = 'https://proxy.mengze.vip/proxy/';

function requestWithTimeout(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, {
    signal: controller.signal,
    headers: { Accept: 'application/json' },
  }).finally(() => clearTimeout(timer));
}

function splitGroups(value) {
  return String(value || '').split('$$$').filter(Boolean);
}

function normalizeDescription(value) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(value || '');
  return decoder.value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseEpisodes(playUrl, playFrom = '') {
  const groups = splitGroups(playUrl);
  const sourceNames = splitGroups(playFrom);

  return groups.flatMap((group, groupIndex) =>
    String(group)
      .split(/[|#]/)
      .filter(Boolean)
      .map((item, index) => {
        const [name, ...urlParts] = item.split('$');
        const url = urlParts.join('$').trim();
        if (!url) return null;
        return {
          name: name?.trim() || `第 ${index + 1} 集`,
          url,
          line: sourceNames[groupIndex] || `线路 ${groupIndex + 1}`,
        };
      })
      .filter(Boolean),
  );
}

export function normalizeVideo(raw, source) {
  const episodes = parseEpisodes(raw.vod_play_url, raw.vod_play_from).map(episode => ({
    ...episode,
    catalogSource: source.name,
    sourceId: source.id,
    groupKey: `${source.id}:${episode.line}`,
  }));

  return {
    key: `${source.id}:${raw.vod_id}`,
    sourceId: source.id,
    sourceName: source.name,
    id: String(raw.vod_id ?? ''),
    title: raw.vod_name || '未命名视频',
    poster: raw.vod_pic || '',
    type: raw.type_name || '未分类',
    typeId: raw.type_id,
    year: raw.vod_year || '',
    area: raw.vod_area || '',
    language: raw.vod_lang || '',
    remark: raw.vod_remarks || '',
    score: raw.vod_score || '',
    actors: raw.vod_actor || '',
    director: raw.vod_director || '',
    content: normalizeDescription(raw.vod_content || raw.vod_blurb),
    updatedAt: raw.vod_time || '',
    episodes,
  };
}

function buildUrl(source, params) {
  const url = new URL(source.url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

export async function fetchSource(source, params = {}, proxy = DEFAULT_PROXY) {
  const apiUrl = new URL('./api/vod', window.location.href);
  apiUrl.searchParams.set('source', source.id);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      apiUrl.searchParams.set(key, value);
    }
  });

  let response;
  try {
    response = await requestWithTimeout(apiUrl.toString());
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('同源 API 不可用');
    }
  } catch (error) {
    if (!proxy) throw error;
    const target = buildUrl(source, params);
    response = await requestWithTimeout(`${proxy}${encodeURIComponent(target)}`);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.list)) throw new Error(data.msg || '返回格式不正确');
  return data;
}

export async function fetchVideos(sources, params, proxy = DEFAULT_PROXY) {
  const enabledSources = sources.filter(source => source.isEnabled !== false);
  const results = await Promise.allSettled(
    enabledSources.map(async source => ({
      source,
      data: await fetchSource(source, params, proxy),
    })),
  );

  const rawVideos = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result =>
      result.value.data.list.map(item => normalizeVideo(item, result.value.source)),
    );

  const unique = new Map();
  rawVideos.forEach(video => {
    const dedupeKey = `${video.title}|${video.year}|${video.type}`;
    const existing = unique.get(dedupeKey);
    const variant = {
      sourceId: video.sourceId,
      sourceName: video.sourceName,
      id: video.id,
    };
    if (!existing) {
      unique.set(dedupeKey, {
        ...video,
        sources: [video.sourceName],
        variants: [variant],
      });
    } else {
      if (!existing.sources.includes(video.sourceName)) {
        existing.sources.push(video.sourceName);
      }
      if (!existing.variants.some(item => item.sourceId === variant.sourceId && item.id === variant.id)) {
        existing.variants.push(variant);
      }
    }
  });

  return {
    videos: [...unique.values()],
    total: rawVideos.length,
    failed: results.filter(result => result.status === 'rejected').length,
  };
}

export async function fetchDetail(source, id, proxy = DEFAULT_PROXY) {
  const data = await fetchSource(source, { ac: 'detail', ids: id }, proxy);
  return data.list[0] ? normalizeVideo(data.list[0], source) : null;
}

export { DEFAULT_PROXY };
