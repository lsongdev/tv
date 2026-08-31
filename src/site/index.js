import { h, render } from 'https://cdn.jsdelivr.net/npm/preact@10.29.8/+esm';
import { useEffect, useState } from 'https://cdn.jsdelivr.net/npm/preact@10.29.8/hooks/+esm';
import { DEFAULT_PROXY, fetchDetail, fetchVideos } from './client.js';

const FALLBACK_POSTER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="420" height="600" viewBox="0 0 420 600"%3E%3Crect width="420" height="600" fill="%2316191f"/%3E%3Ccircle cx="210" cy="260" r="70" fill="none" stroke="%23303642" stroke-width="2"/%3E%3Cpath d="M190 222l62 38-62 38z" fill="%23303642"/%3E%3Ctext x="210" y="370" text-anchor="middle" fill="%236b7280" font-family="sans-serif" font-size="18"%3ENO POSTER%3C/text%3E%3C/svg%3E';
const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'movie', label: '电影', matches: ['片', '电影'] },
  { id: 'series', label: '剧集', matches: ['剧'] },
  { id: 'anime', label: '动漫', matches: ['动漫', '动画'] },
  { id: 'show', label: '综艺', matches: ['综艺'] },
];

const getProxy = () => localStorage.getItem('api_proxy') || DEFAULT_PROXY;
const loadSources = () => fetch('./vod.json').then(response => {
  if (!response.ok) throw new Error('无法读取数据源配置');
  return response.json();
});

function AppHeader({ query = '', setQuery = () => {}, onSearch = () => {} }) {
  return h('header', { className: 'site-header' }, [
    h('a', { href: '#/', className: 'brand', 'aria-label': '返回首页' }, [
      h('span', { className: 'brand-mark' }, 'TV'),
      h('span', { className: 'brand-name' }, '聚合影库'),
    ]),
    h('form', {
      className: 'search-form',
      onSubmit: event => {
        event.preventDefault();
        onSearch();
      },
    }, [
      h('input', {
        value: query,
        onInput: event => setQuery(event.currentTarget.value),
        placeholder: '搜索电影、剧集、综艺…',
        'aria-label': '搜索视频',
      }),
      h('button', { type: 'submit' }, '搜索'),
    ]),
    h('a', { href: '#/settings', className: 'quiet-link' }, '设置'),
  ]);
}

function Tag({ children, tone = '' }) {
  return h('span', { className: `tag ${tone}` }, children);
}

function VideoCard({ video }) {
  return h('a', {
    className: 'video-card',
    href: `#/detail/${encodeURIComponent(video.sourceId)}:${encodeURIComponent(video.id)}`,
  }, [
    h('div', { className: 'poster-wrap' }, [
      h('img', {
        src: video.poster || FALLBACK_POSTER,
        alt: video.title,
        loading: 'lazy',
        onError: event => {
          event.currentTarget.src = FALLBACK_POSTER;
        },
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

function HomeView() {
  const [sources, setSources] = useState([]);
  const [videos, setVideos] = useState([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const requestVideos = (activeSources, keyword = '') => {
    setLoading(true);
    setNotice('');
    const params = keyword
      ? { ac: 'detail', wd: keyword, pg: 1 }
      : { ac: 'detail', pg: 1 };

    return fetchVideos(activeSources, params, getProxy())
      .then(result => {
        setVideos(result.videos);
        if (result.failed) {
          setNotice(`已汇总 ${result.total} 条数据，${result.failed} 个来源暂时没有响应。`);
        }
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
      .catch(error => {
        setNotice(error.message);
        setLoading(false);
      });
  }, []);

  const search = () => {
    setActiveFilter('all');
    requestVideos(sources, query.trim());
  };

  const active = FILTERS.find(filter => filter.id === activeFilter);
  const visibleVideos = !active?.matches
    ? videos
    : videos.filter(video => active.matches.some(word => video.type.includes(word)));

  return h('div', null, [
    h(AppHeader, { query, setQuery, onSearch: search }),
    h('main', null, [
      h('section', { className: 'hero' }, [
        h('p', { className: 'eyebrow' }, 'MULTI-SOURCE · OPEN CATALOG'),
        h('h1', null, query ? `搜索「${query}」` : '今天，找点好看的。'),
        h('p', { className: 'hero-copy' }, '从多个公开影视目录中检索内容，统一整理片名、详情与播放线路。'),
        h('p', { className: 'source-count' }, `${sources.length || '—'} 个数据源已配置`),
      ]),
      h('nav', { className: 'filter-bar', 'aria-label': '内容分类' },
        FILTERS.map(filter => h('button', {
          className: activeFilter === filter.id ? 'active' : '',
          onClick: () => setActiveFilter(filter.id),
        }, filter.label)),
      ),
      notice && h('div', { className: 'notice' }, notice),
      loading
        ? h('div', { className: 'state' }, '正在整理片源…')
        : visibleVideos.length
          ? h('section', { className: 'video-grid', 'aria-live': 'polite' },
            visibleVideos.map(video => h(VideoCard, { video, key: video.key })),
          )
          : h('div', { className: 'state' }, '没有找到相关内容'),
    ]),
  ]);
}

function VideoPlayer({ episode }) {
  useEffect(() => {
    if (!episode) return undefined;
    const video = document.getElementById('video-player');
    if (!video) return undefined;
    let hls;

    if (/\.m3u8(?:$|\?)/i.test(episode.url) && window.Hls?.isSupported()) {
      hls = new window.Hls({ enableWorker: true });
      hls.loadSource(episode.url);
      hls.attachMedia(video);
    } else {
      video.src = episode.url;
    }

    return () => {
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [episode?.url]);

  if (!episode) return null;
  return h('div', { className: 'player-shell' }, [
    h('video', { id: 'video-player', controls: true, playsInline: true }),
    h('div', { className: 'now-playing' }, [
      h('span', null, episode.name),
      h('span', null, episode.source),
    ]),
  ]);
}

function DetailView({ id }) {
  const [video, setVideo] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const decoded = decodeURIComponent(id);
    const separator = decoded.indexOf(':');
    const sourceId = decoded.slice(0, separator);
    const videoId = decoded.slice(separator + 1);

    loadSources()
      .then(config => {
        const source = config.find(item => item.id === sourceId);
        if (!source) throw new Error('找不到对应的数据源');
        return fetchDetail(source, videoId, getProxy());
      })
      .then(result => {
        if (!result) throw new Error('该条目已不存在');
        setVideo(result);
        setEpisode(result.episodes[0] || null);
      })
      .catch(reason => setError(reason.message));
  }, [id]);

  if (error) {
    return h('div', { className: 'state full-page' }, [
      h('p', null, `加载失败：${error}`),
      h('a', { href: '#/' }, '返回首页'),
    ]);
  }
  if (!video) return h('div', { className: 'state full-page' }, '正在读取详情…');

  return h('div', null, [
    h(AppHeader),
    h('main', { className: 'detail-page' }, [
      h('a', { href: '#/', className: 'back-link' }, '← 返回影库'),
      h('section', { className: 'detail-hero' }, [
        h('img', {
          className: 'detail-poster',
          src: video.poster || FALLBACK_POSTER,
          alt: video.title,
          onError: event => { event.currentTarget.src = FALLBACK_POSTER; },
        }),
        h('div', { className: 'detail-copy' }, [
          h('p', { className: 'eyebrow' }, video.sourceName),
          h('h1', null, video.title),
          h('div', { className: 'detail-tags' },
            [video.type, video.year, video.area, video.remark].filter(Boolean)
              .map(value => h(Tag, null, value)),
          ),
          h('p', { className: 'plot' }, video.content || '暂无剧情简介。'),
          video.director && h('p', { className: 'credit' }, `导演：${video.director}`),
          video.actors && h('p', { className: 'credit' }, `主演：${video.actors}`),
        ]),
      ]),
      h(VideoPlayer, { episode }),
      h('section', { className: 'play-section' }, [
        h('div', { className: 'section-heading' }, [
          h('h2', null, '播放列表'),
          h('span', null, `${video.episodes.length} 个条目`),
        ]),
        video.episodes.length
          ? h('div', { className: 'episodes' }, video.episodes.map(item => h('button', {
            className: episode?.url === item.url ? 'active' : '',
            onClick: () => setEpisode(item),
          }, [h('span', null, item.name), h('small', null, item.source)])))
          : h('div', { className: 'notice' }, '该条目暂未返回可用播放地址。'),
      ]),
    ]),
  ]);
}

function SettingsView() {
  const [proxy, setProxy] = useState(getProxy());
  return h('main', { className: 'settings-page' }, [
    h('a', { href: '#/', className: 'back-link' }, '← 返回影库'),
    h('p', { className: 'eyebrow' }, 'CONNECTION'),
    h('h1', null, '数据连接'),
    h('p', { className: 'muted' }, '部署在 Cloudflare Workers 时使用同源 API。下面的代理地址仅供 GitHub Pages 或普通静态预览回退使用。'),
    h('label', { htmlFor: 'proxy' }, '静态托管回退代理'),
    h('input', {
      id: 'proxy',
      value: proxy,
      onInput: event => setProxy(event.currentTarget.value),
    }),
    h('button', {
      className: 'primary-button',
      onClick: () => {
        localStorage.setItem('api_proxy', proxy.trim());
        window.location.hash = '#/';
        window.location.reload();
      },
    }, '保存设置'),
  ]);
}

function currentRoute() {
  const path = window.location.hash.replace(/^#/, '') || '/';
  if (path === '/settings') return { name: 'settings' };
  if (path.startsWith('/detail/')) {
    return { name: 'detail', id: path.slice('/detail/'.length) };
  }
  return { name: 'home' };
}

function App() {
  const [route, setRoute] = useState(currentRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route.name === 'settings') return h(SettingsView);
  if (route.name === 'detail') return h(DetailView, { id: route.id });
  return h(HomeView);
}

render(h(App), document.getElementById('app'));
