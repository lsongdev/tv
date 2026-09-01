import { h, render } from 'https://cdn.jsdelivr.net/npm/preact@10.29.8/+esm';
import { useEffect, useRef, useState } from 'https://cdn.jsdelivr.net/npm/preact@10.29.8/hooks/+esm';
import { bindDialog, showDialog } from 'https://lsong.org/scripts/dom/dialog.js';
import {
  DEFAULT_PROXY,
  fetchDetail,
  fetchVideos,
  normalizeWorkTitle,
  normalizeWorkYear,
} from './client.js';

const FALLBACK_POSTER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="420" height="600" viewBox="0 0 420 600"%3E%3Crect width="420" height="600" fill="%23f1f3f5"/%3E%3Ccircle cx="210" cy="260" r="70" fill="none" stroke="%23cbd0d6" stroke-width="2"/%3E%3Cpath d="M190 222l62 38-62 38z" fill="%23cbd0d6"/%3E%3Ctext x="210" y="370" text-anchor="middle" fill="%23868e96" font-family="sans-serif" font-size="18"%3ENO POSTER%3C/text%3E%3C/svg%3E';
const ALL_FILTER = '__all__';

const getProxy = () => localStorage.getItem('api_proxy') || DEFAULT_PROXY;
const loadSources = () => fetch('/vod.json').then(response => {
  if (!response.ok) throw new Error('无法读取数据源配置');
  return response.json();
});
const isHlsUrl = url => /\.m3u8(?:$|[?#])/i.test(url);
const isDirectMediaUrl = url => /\.(?:m3u8|mp4|m4v|webm|ogv|ogg)(?:$|[?#])/i.test(url);

function pathTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim() || 'untitled';
}

function workPath({ title, year }, episodeNumber = '') {
  const base = `/s/${encodeURIComponent(normalizeWorkYear(year) || '0')}/${encodeURIComponent(pathTitle(title))}`;
  return episodeNumber ? `${base}/${encodeURIComponent(episodeNumber)}` : base;
}

function PageContent({ children, mainClass = '' }) {
  useEffect(() => {
    const app = document.getElementById('app');
    app.className = `content ${mainClass}`.trim();
    app.removeAttribute('aria-busy');
  }, [mainClass]);
  return children;
}

function Tag({ children, tone = '' }) {
  return h('span', { className: `tag ${tone}`.trim() }, children);
}

function SearchForm({ query, setQuery, onSearch }) {
  return h('form', {
    className: 'form search-form',
    onSubmit: event => { event.preventDefault(); onSearch(); },
  }, [
    h('input', {
      className: 'input',
      value: query,
      onInput: event => setQuery(event.currentTarget.value),
      placeholder: '搜索电影、剧集、综艺…',
      'aria-label': '搜索视频',
    }),
    h('button', { className: 'button', type: 'submit' }, '搜索'),
  ]);
}

function VideoCard({ video }) {
  return h('a', {
    className: 'video-card',
    href: workPath(video),
  }, [
    h('div', { className: 'poster-wrap' }, [
      h('img', {
        src: video.poster || FALLBACK_POSTER,
        alt: video.title,
        loading: 'lazy',
        onError: event => { event.currentTarget.src = FALLBACK_POSTER; },
      }),
      video.remark && h(Tag, { tone: 'on-poster' }, video.remark),
    ]),
    h('div', { className: 'card-copy' }, [
      h('h3', null, video.title),
      h('p', { className: 'card-meta' }, [
        h('span', null, video.type),
        (video.year || video.area) && h('span', null, video.year || video.area),
      ]),
      h('p', { className: 'source-name' }, [
        video.sourceName,
        video.sources?.length > 1 ? ` · ${video.sources.length} 个来源` : '',
      ]),
    ]),
  ]);
}

function CatalogSkeleton({ count = 8 }) {
  return h('section', { className: 'video-grid skeleton-grid', 'aria-label': '正在加载视频', 'aria-busy': 'true' },
    Array.from({ length: count }, (_, index) => h('div', { className: 'skeleton-card', key: index }, [
      h('div', { className: 'skeleton skeleton-poster' }),
      h('div', { className: 'skeleton skeleton-title' }),
      h('div', { className: 'skeleton skeleton-meta' }),
    ])),
  );
}

function DetailSkeleton() {
  return h(PageContent, { mainClass: 'detail-page' }, [
    h('div', { className: 'detail-skeleton', 'aria-busy': 'true' }, [
      h('div', { className: 'skeleton skeleton-detail-poster' }),
      h('div', { className: 'detail-skeleton-copy' }, [
        h('div', { className: 'skeleton skeleton-kicker' }),
        h('div', { className: 'skeleton skeleton-heading' }),
        h('div', { className: 'skeleton skeleton-copy' }),
        h('div', { className: 'skeleton skeleton-copy short' }),
      ]),
    ]),
    h('div', { className: 'skeleton skeleton-player' }),
  ]);
}

function HomeView() {
  const [sources, setSources] = useState([]);
  const [videos, setVideos] = useState([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(ALL_FILTER);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const requestVideos = (activeSources, keyword = '') => {
    setLoading(true);
    setNotice('');
    const params = keyword ? { ac: 'detail', wd: keyword, pg: 1 } : { ac: 'detail', pg: 1 };
    return fetchVideos(activeSources, params, getProxy())
      .then(result => {
        setVideos(result.videos);
        if (result.failed) setNotice(`已汇总 ${result.total} 条数据，${result.failed} 个来源暂时没有响应。`);
      })
      .catch(() => setNotice('数据暂时无法加载，请稍后重试或检查连接设置。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSources()
      .then(config => {
        const enabled = config.filter(source => source.isEnabled !== false);
        setSources(enabled);
        return requestVideos(enabled);
      })
      .catch(error => { setNotice(error.message); setLoading(false); });
  }, []);

  const search = () => { setActiveFilter(ALL_FILTER); requestVideos(sources, query.trim()); };
  const categoryCounts = videos.reduce((counts, video) => {
    const category = String(video.type || '未分类').trim() || '未分类';
    counts.set(category, (counts.get(category) || 0) + 1);
    return counts;
  }, new Map());
  const filters = [
    { id: ALL_FILTER, label: '全部', count: videos.length },
    ...[...categoryCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN'))
      .map(([label, count]) => ({ id: label, label, count })),
  ];
  const visibleVideos = activeFilter === ALL_FILTER
    ? videos
    : videos.filter(video => (String(video.type || '未分类').trim() || '未分类') === activeFilter);

  return h(PageContent, { mainClass: 'layout-content tv-main' }, [
    h('section', { className: 'site-hero tv-hero', 'aria-labelledby': 'hero-title' }, [
      h('div', { className: 'tv-hero-copy' }, [
        h('p', { className: 'eyebrow' }, '今晚，从这里开始'),
        h('h1', { id: 'hero-title', className: 'site-hero-title' }, [
          '想看的，',
          h('br'),
          h('span', null, '马上开播。'),
        ]),
        h('p', { className: 'site-hero-copy' }, '电影、剧集、动漫和综艺，搜到喜欢的，就从这一集开始。'),
        h(SearchForm, { query, setQuery, onSearch: search }),
      ]),
      h('div', { className: 'hero-tv', 'aria-hidden': 'true' }, [
        h('div', { className: 'hero-tv-antenna' }, [h('i'), h('i')]),
        h('div', { className: 'hero-tv-body' }, [
          h('div', { className: 'hero-tv-screen' }, [
            h('div', { className: 'hero-tv-glow' }),
            h('span', { className: 'hero-tv-play' }, '▶'),
            h('div', { className: 'hero-tv-caption' }, [h('i'), h('span', null, 'NOW PLAYING')]),
          ]),
          h('div', { className: 'hero-tv-controls' }, [
            h('div', { className: 'hero-tv-speaker' }, [h('i'), h('i'), h('i'), h('i')]),
            h('span'),
            h('b'),
          ]),
        ]),
        h('div', { className: 'hero-tv-shadow' }),
      ]),
    ]),
    h('section', { className: 'catalog-section', 'aria-labelledby': 'catalog-title' }, [
      h('div', { className: 'catalog-heading' }, [
        h('h2', { id: 'catalog-title' }, query ? '搜索结果' : '最近更新'),
        h('nav', { className: 'filter-bar', 'aria-label': '内容分类' }, filters.map(filter => h('button', {
          key: filter.id,
          className: activeFilter === filter.id ? 'active' : '',
          onClick: () => setActiveFilter(filter.id),
        }, filter.label))),
      ]),
      notice && h('div', { className: 'notice' }, notice),
      loading
        ? h(CatalogSkeleton)
        : visibleVideos.length
          ? h('section', { className: 'video-grid', 'aria-live': 'polite' }, visibleVideos.map(video => h(VideoCard, { video, key: video.key })))
          : h('div', { className: 'state' }, '没有找到相关内容'),
    ]),
  ]);
}

async function loadAggregatedDetail(config, title, year) {
  const normalizedTitle = normalizeWorkTitle(title);
  const normalizedYear = normalizeWorkYear(year);
  let search = await fetchVideos(config, { ac: 'detail', wd: title, pg: 1 }, getProxy());
  let titleMatches = search.videos.filter(video => normalizeWorkTitle(video.title) === normalizedTitle);
  const fallbackKeyword = [...normalizedTitle].slice(0, 4).join('');
  if (!titleMatches.length && fallbackKeyword && fallbackKeyword !== title) {
    search = await fetchVideos(config, { ac: 'detail', wd: fallbackKeyword, pg: 1 }, getProxy());
    titleMatches = search.videos.filter(video => normalizeWorkTitle(video.title) === normalizedTitle);
  }
  const match = titleMatches.find(video => normalizeWorkYear(video.year) === normalizedYear)
    || titleMatches.find(video => !normalizeWorkYear(video.year))
    || (!normalizedYear ? titleMatches[0] : null);
  if (!match) throw new Error('找不到与分享地址匹配的作品');

  const variants = (match.variants || []).filter((item, index, list) =>
    item.sourceId && item.id && list.findIndex(candidate => candidate.sourceId === item.sourceId && candidate.id === item.id) === index,
  );
  const results = await Promise.allSettled(variants.map(async variant => {
    const source = config.find(item => item.id === variant.sourceId);
    if (!source) throw new Error('找不到对应的数据源');
    return fetchDetail(source, variant.id, getProxy());
  }));
  const details = results.filter(result => result.status === 'fulfilled' && result.value).map(result => result.value);
  if (!details.length) throw new Error('该条目已不存在或所有来源均不可用');
  const main = details.find(item => normalizeWorkYear(item.year) === normalizedYear) || details[0];
  return {
    ...main,
    stableTitle: match.title,
    stableYear: normalizedYear || normalizeWorkYear(main.year) || '0',
    sources: [...new Set(details.map(item => item.sourceName))],
    episodes: details.flatMap(item => item.episodes),
  };
}

function groupEpisodes(episodes) {
  const groups = new Map();
  episodes.forEach(episode => {
    if (!groups.has(episode.groupKey)) {
      groups.set(episode.groupKey, {
        key: episode.groupKey,
        label: `${episode.catalogSource} / ${episode.line}`,
        episodes: [],
      });
    }
    groups.get(episode.groupKey).episodes.push(episode);
  });
  return [...groups.values()].sort((left, right) =>
    Number(right.episodes.some(item => isDirectMediaUrl(item.url)))
    - Number(left.episodes.some(item => isDirectMediaUrl(item.url))),
  );
}

function chineseNumber(value) {
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (/^[零〇一二两三四五六七八九]$/.test(value)) return digits[value];
  if (!/^[零〇一二两三四五六七八九十百]+$/.test(value)) return null;
  let total = 0;
  let current = 0;
  for (const character of value) {
    if (character === '百') {
      total += (current || 1) * 100;
      current = 0;
    } else if (character === '十') {
      total += (current || 1) * 10;
      current = 0;
    } else {
      current = digits[character];
    }
  }
  return total + current;
}

function episodeNumber(episode, index) {
  const name = String(episode?.name || '').normalize('NFKC').trim();
  const numeric = name.match(/第\s*0*(\d{1,4})\s*(?:集|话|期)/)
    || name.match(/^(?:EP(?:ISODE)?|E)\s*0*(\d{1,4})$/i)
    || name.match(/^0*(\d{1,4})(?:\s*(?:集|话|期))?$/);
  if (numeric) return String(Number(numeric[1]));
  const chinese = name.match(/第\s*([零〇一二两三四五六七八九十百]+)\s*(?:集|话|期)/);
  const parsed = chinese ? chineseNumber(chinese[1]) : null;
  return String(parsed || index + 1);
}

function findEpisode(groups, number) {
  if (!number) return null;
  for (const group of groups) {
    const index = group.episodes.findIndex((episode, episodeIndex) => episodeNumber(episode, episodeIndex) === number);
    if (index >= 0) return { group, episode: group.episodes[index], index };
  }
  return null;
}

function VideoPlayer({ episode }) {
  const [playerError, setPlayerError] = useState('');
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const directMedia = episode && isDirectMediaUrl(episode.url);

  useEffect(() => {
    setPlayerError('');
    setAutoplayMuted(false);
    if (!episode || !directMedia) return undefined;
    const video = document.getElementById('video-player');
    if (!video) return undefined;
    let hls;
    let autoplayStarted = false;
    const fail = () => setPlayerError('该线路暂时无法加载，请在播放器下方切换其他来源或线路。');
    const startAutoplay = () => {
      if (autoplayStarted) return;
      autoplayStarted = true;
      void (async () => {
        try {
          video.muted = false;
          await video.play();
        } catch (_error) {
          try {
            video.muted = true;
            await video.play();
            setAutoplayMuted(true);
          } catch (_mutedError) {
            setPlayerError('浏览器阻止了自动播放，请点击播放器开始。');
          }
        }
      })();
    };
    video.addEventListener('error', fail);
    video.addEventListener('canplay', startAutoplay);

    if (isHlsUrl(episode.url) && window.Hls?.isSupported()) {
      hls = new window.Hls({ enableWorker: true });
      hls.on(window.Hls.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
      hls.loadSource(episode.url);
      hls.attachMedia(video);
    } else if (isHlsUrl(episode.url) && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = episode.url;
    } else if (isHlsUrl(episode.url)) {
      setPlayerError('当前浏览器不支持 HLS 播放，请在播放器下方切换其他线路，或更换浏览器。');
    } else {
      video.src = episode.url;
    }

    return () => {
      video.removeEventListener('error', fail);
      video.removeEventListener('canplay', startAutoplay);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [episode?.url, directMedia]);

  if (!episode) return null;
  if (!directMedia) {
    return h('div', { className: 'player-fallback' }, [
      h('p', { className: 'eyebrow' }, 'EXTERNAL PLAYER'),
      h('h2', null, '这条线路是播放页，不是媒体文件。'),
      h('p', null, '为避免出现黑屏，它不会再被放进视频播放器。你可以打开来源提供的原始播放页。'),
      h('a', { className: 'button', href: episode.url, target: '_blank', rel: 'noopener noreferrer' }, '打开原始播放页'),
    ]);
  }
  return h('div', { className: 'player-shell' }, [
    h('video', { id: 'video-player', controls: true, playsInline: true, preload: 'auto', autoPlay: true }),
    playerError && h('div', { className: 'player-error', role: 'status' }, playerError),
    autoplayMuted && h('div', { className: 'autoplay-notice', role: 'status' }, '已静音自动播放，可在播放器中恢复声音。'),
    h('div', { className: 'now-playing' }, [
      h('span', null, episode.name),
      h('span', null, `${episode.catalogSource} / ${episode.line}`),
    ]),
  ]);
}

function DetailView({ title, year, requestedEpisode }) {
  const [video, setVideo] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [activeGroup, setActiveGroup] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setVideo(null);
    setError('');
    loadSources()
      .then(config => loadAggregatedDetail(config, title, year))
      .then(result => {
        const groups = groupEpisodes(result.episodes);
        const requested = findEpisode(groups, requestedEpisode);
        const initialGroup = requested?.group || groups[0];
        const canonicalPath = workPath({ title: result.stableTitle, year: result.stableYear }, requestedEpisode);
        if (window.location.pathname !== canonicalPath) window.history.replaceState(null, '', canonicalPath);
        setVideo(result);
        setActiveGroup(initialGroup?.key || '');
        setEpisode(requested?.episode || initialGroup?.episodes[0] || null);
      })
      .catch(reason => setError(reason.message));
  }, [title, year, requestedEpisode]);

  if (error) {
    return h(PageContent, null, h('div', { className: 'state full-page' }, [
      h('p', null, `加载失败：${error}`),
      h('a', { href: '/' }, '返回首页'),
    ]));
  }
  if (!video) return h(DetailSkeleton);

  const groups = groupEpisodes(video.episodes);
  const selectedGroup = groups.find(group => group.key === activeGroup) || groups[0];
  const setShareableEpisode = (nextEpisode, index) => {
    setEpisode(nextEpisode);
    window.history.replaceState(null, '', workPath({ title: video.stableTitle, year: video.stableYear }, episodeNumber(nextEpisode, index)));
  };
  const selectGroup = group => {
    const currentIndex = selectedGroup?.episodes.findIndex(item => item.url === episode?.url) ?? -1;
    const currentNumber = episode ? episodeNumber(episode, Math.max(currentIndex, 0)) : '';
    const nextIndex = group.episodes.findIndex((item, index) => episodeNumber(item, index) === currentNumber);
    const resolvedIndex = nextIndex >= 0 ? nextIndex : 0;
    const nextEpisode = group.episodes[resolvedIndex] || null;
    setActiveGroup(group.key);
    if (nextEpisode) setShareableEpisode(nextEpisode, resolvedIndex);
  };
  return h(PageContent, { mainClass: 'detail-page' }, [
    h('section', { className: 'detail-hero' }, [
      h('img', {
        className: 'detail-poster',
        src: video.poster || FALLBACK_POSTER,
        alt: video.title,
        onError: event => { event.currentTarget.src = FALLBACK_POSTER; },
      }),
      h('div', { className: 'detail-copy' }, [
        h('h1', null, video.title),
        h('div', { className: 'detail-tags' }, [video.type, video.year, video.area, video.remark].filter(Boolean).map(value => h(Tag, null, value))),
        video.director && h('p', { className: 'credit' }, `导演：${video.director}`),
        video.actors && h('p', { className: 'credit' }, `主演：${video.actors}`),
      ]),
    ]),
    h('section', { className: 'detail-description', 'aria-labelledby': 'description-title' }, [
      h('p', { className: 'eyebrow' }, 'STORY'),
      h('h2', { id: 'description-title' }, '剧情简介'),
      h('p', { className: 'plot' }, video.content || '暂无剧情简介。'),
    ]),
    groups.length ? h('section', { className: 'play-section' }, [
      h('div', { className: 'section-heading' }, [
        h('div', null, [h('p', { className: 'eyebrow' }, 'SOURCES / LINES'), h('h2', null, '选择播放线路')]),
        h('span', null, `${groups.length} 条线路 · ${video.episodes.length} 个条目`),
      ]),
      h(VideoPlayer, { episode }),
      h('div', { className: 'source-tabs', role: 'tablist', 'aria-label': '播放来源与线路' }, groups.map(group => h('button', {
        className: group.key === selectedGroup?.key ? 'active' : '',
        role: 'tab',
        'aria-selected': group.key === selectedGroup?.key,
        onClick: () => selectGroup(group),
      }, [h('span', null, group.label), h('small', null, `${group.episodes.length} 集`)]))),
      h('div', { className: 'episodes' }, selectedGroup.episodes.map((item, index) => h('button', {
        className: episode?.url === item.url ? 'active' : '',
        onClick: () => setShareableEpisode(item, index),
      }, item.name))),
    ]) : h('div', { className: 'notice' }, '该条目暂未返回可用播放地址。'),
  ]);
}

function SettingsDialog() {
  const [proxy, setProxy] = useState(getProxy());
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const unbind = bindDialog(dialog);
    const open = () => {
      setProxy(getProxy());
      showDialog(dialog, { initialFocus: '#proxy' });
    };
    const openFromTrigger = event => {
      if (!event.target.closest?.('[data-settings-trigger]')) return;
      event.preventDefault();
      open();
    };
    document.addEventListener('click', openFromTrigger);
    return () => {
      document.removeEventListener('click', openFromTrigger);
      unbind();
    };
  }, []);

  return h('dialog', { className: 'dialog settings-dialog', ref: dialogRef },
    h('form', {
      onSubmit: event => {
        event.preventDefault();
        localStorage.setItem('api_proxy', proxy.trim());
        dialogRef.current?.close('save');
        window.location.reload();
      },
    }, [
      h('header', { className: 'dialog-header' }, [
        h('div', null, [h('p', { className: 'eyebrow' }, 'CONNECTION'), h('h2', null, '数据连接')]),
        h('button', { className: 'dialog-close', type: 'button', 'data-dialog-close': true, 'aria-label': '关闭设置' }, '×'),
      ]),
      h('div', { className: 'dialog-body' }, [
        h('p', { className: 'muted' }, '部署在 Cloudflare Workers 时使用同源 API。下面的代理地址仅供 GitHub Pages 或普通静态预览回退使用。'),
        h('label', { className: 'dialog-field', htmlFor: 'proxy' }, [
          h('span', null, '静态托管回退代理'),
          h('input', { className: 'input', id: 'proxy', value: proxy, onInput: event => setProxy(event.currentTarget.value) }),
        ]),
      ]),
      h('footer', { className: 'dialog-footer' }, [
        h('button', { className: 'button', type: 'button', 'data-dialog-close': true }, '取消'),
        h('button', { className: 'button primary-button', type: 'submit' }, '保存设置'),
      ]),
    ]),
  );
}

function currentRoute() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments[0] === 's' && (segments.length === 3 || segments.length === 4)) {
    try {
      return {
        name: 'detail',
        year: decodeURIComponent(segments[1]),
        title: decodeURIComponent(segments[2]),
        requestedEpisode: segments[3] ? decodeURIComponent(segments[3]) : '',
      };
    } catch (_error) {
      return { name: 'home' };
    }
  }
  return { name: 'home' };
}

function App() {
  const [route, setRoute] = useState(currentRoute());
  useEffect(() => {
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  return [
    route.name === 'detail' ? h(DetailView, { ...route, key: 'view' }) : h(HomeView, { key: 'view' }),
    h(SettingsDialog, { key: 'settings' }),
  ];
}

const appRoot = document.getElementById('app');
appRoot.replaceChildren();
appRoot.className = 'content';
appRoot.removeAttribute('aria-busy');
render(h(App), appRoot);
