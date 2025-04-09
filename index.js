import { ready } from 'https://lsong.org/scripts/dom.js';
import { h, render, useState, useEffect, useRouter } from 'https://lsong.org/scripts/react/index.js';  // preact
import VodApiClient from './client.js';

const SettingsView = () => {
  const [endpoint, setEndpoint] = useState(localStorage.getItem('api_endpoint') || 'https://heimuer.tv');
  const [player, setPlayer] = useState(localStorage.getItem('player_url') || 'https://hoplayer.com/index.html?url=');

  const saveSettings = () => {
    localStorage.setItem('api_endpoint', endpoint);
    localStorage.setItem('player_url', player);
    window.location.reload();
  };

  return h('div', { className: 'settings' }, [
    h('h2', null, '设置'),
    h('div', { className: 'settings-form' }, [
      h('div', { className: 'form-group' }, [
        h('label', null, 'API 地址'),
        h('input', {
          type: 'text',
          value: endpoint,
          onInput: e => setEndpoint(e.target.value),
          placeholder: '请输入 API 地址'
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', null, '播放器地址'),
        h('input', {
          type: 'text',
          value: player,
          onInput: e => setPlayer(e.target.value),
          placeholder: '请输入播放器地址'
        })
      ]),
      h('button', {
        className: 'save-button',
        onClick: saveSettings
      }, '保存设置')
    ])
  ]);
};

const HomeView = () => {
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const endpoint = localStorage.getItem('api_endpoint') || 'https://heimuer.tv';
  const playerUrl = localStorage.getItem('player_url') || 'https://hoplayer.com/index.html?url=';

  useEffect(() => {
    VodApiClient(endpoint)
      .list()
      .json()
      .then(data => setCategories(data.class));
  }, []);

  useEffect(() => {
    if (searchQuery) {
      VodApiClient(endpoint)
        .detail()
        .search(searchQuery)
        .json()
        .then(data => setVideos(data.list));
    } else {
      VodApiClient(endpoint)
        .detail()
        .category(selectedCategory)
        .json()
        .then(data => setVideos(data.list));
    }
  }, [selectedCategory, searchQuery, endpoint]);

  if (!videos) return h('div', { className: 'loading' }, '加载中...');

  return h('div', { className: 'video-list' }, [
    h('div', { className: 'search-box' }, [
      h('input', {
        type: 'text',
        placeholder: '搜索视频...',
        value: searchQuery,
        onInput: e => setSearchQuery(e.target.value),
        className: 'search-input'
      }),
      h('button', {
        className: 'search-button',
        onClick: () => {
          if (searchQuery) {
            VodApiClient(endpoint)
              .detail()
              .search(searchQuery)
              .json()
              .then(data => setVideos(data.list));
          }
        }
      }, '搜索')
    ]),
    h('div', { className: 'category-list' }, [
      h('a', {
        className: `category-item ${!selectedCategory ? 'active' : ''}`,
        href: '#',
        onClick: e => {
          e.preventDefault();
          setSelectedCategory(null);
          setSearchQuery('');
        }
      }, '全部'),
      ...categories.map(category => 
        h('a', {
          key: category.type_id,
          className: `category-item ${selectedCategory === category.type_id ? 'active' : ''}`,
          href: '#',
          onClick: e => {
            e.preventDefault();
            setSelectedCategory(category.type_id);
            setSearchQuery('');
          }
        }, category.type_name)
      )
    ]),
    videos.length == 0 && h('div', { className: 'empty' }, '暂无数据'),
    h('ul', { className: 'videos' }, videos.map(video => 
      h('li', { key: video.vod_id, className: 'video-item' }, [
        h('img', { src: video.vod_pic, alt: video.vod_name }),
        h('div', { className: 'content' }, [
          h('a', { href: `#/detail/${video.vod_id}` }, video.vod_name),
          h('p', { className: 'type' }, `类型: ${video.type_name}`),
          h('p', { className: 'time' }, `更新时间: ${video.vod_time}`),
          h('p', { className: 'status' }, `状态: ${video.vod_remarks}`)
        ])
      ])
    ))
  ]);
}

const DetailView = ({ id }) => {
  const [video, setVideo] = useState(null);
  const endpoint = localStorage.getItem('api_endpoint') || 'https://heimuer.tv';
  const playerUrl = localStorage.getItem('player_url') || 'https://hoplayer.com/index.html?url=';

  useEffect(() => {
    VodApiClient(endpoint)
      .detail(id)
      .json()
      .then(data => setVideo(data.list[0]));
  }, [id, endpoint]);

  if (!video) return h('div', { className: 'loading' }, '加载中...');

  const playUrls = video.vod_play_url.split('#').map(url => {
    const [episode, link] = url.split('$');
    return { episode, link };
  });

  return h('div', { className: 'video-detail' }, [
    h('div', { className: 'detail-header' }, [
      h('img', { src: video.vod_pic, alt: video.vod_name, className: 'detail-poster' }),
      h('div', { className: 'detail-info' }, [
        h('h1', null, video.vod_name),
        h('p', { className: 'detail-subtitle' }, video.vod_sub),
        h('div', { className: 'detail-meta' }, [
          h('span', { className: 'type' }, video.type_name),
          h('span', { className: 'area' }, video.vod_area),
          h('span', { className: 'year' }, video.vod_year),
          h('span', { className: 'status' }, video.vod_remarks)
        ]),
        h('div', { className: 'detail-credits' }, [
          h('p', null, ['主演：', video.vod_actor]),
          h('p', null, ['导演：', video.vod_director])
        ]),
        h('div', { className: 'detail-stats' }, [
          h('span', null, `评分：${video.vod_score}`),
          h('span', null, `更新：${video.vod_time}`)
        ])
      ])
    ]),
    h('div', { className: 'detail-content' }, [
      h('h2', null, '剧情简介'),
      h('p', { className: 'detail-plot' }, video.vod_content),
      h('h2', null, '播放列表'),
      h('div', { className: 'episode-list' }, playUrls.map(({ episode, link }) =>
        h('a', { 
          key: episode, 
          href: playerUrl + link, 
          className: 'episode-item',
          target: '_blank'
        }, episode)
      ))
    ])
  ]);
}

const App = () => {
  return useRouter({
    "/": HomeView,
    "/detail/:id": DetailView,
    "/settings": SettingsView
  })
}

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});