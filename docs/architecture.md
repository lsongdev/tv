# 项目结构

这个项目由静态前端和一个可选的 Cloudflare Worker 数据网关组成。

## 数据流

1. `src/site/vod.json` 保存经过白名单约束的数据源。
2. 浏览器请求同源 `/api/vod`，只提交数据源 ID 和 MacCMS 查询参数。
3. Worker 根据 `src/site/vod.json` 解析真实上游地址，转发请求并短时缓存响应。
4. `src/site/client.js` 把不同来源的 MacCMS 字段转换成统一的视频模型。
5. 页面按片名、年份和类型去重，并保留来源信息。

GitHub Pages 等纯静态环境没有 `/api/vod`。在这种情况下，客户端会回退到设置页中的 CORS 代理。生产环境建议使用 Cloudflare Worker，避免依赖公开第三方代理。

## 数据源格式

```json
{
  "id": "bfzy",
  "name": "暴风资源",
  "url": "https://bfzyapi.com/api.php/provide/vod",
  "format": "maccms-v10",
  "isEnabled": true
}
```

- `id`：稳定且唯一的内部标识，会进入详情页 URL。
- `name`：显示名称。
- `url`：完整的 MacCMS V10 VOD API 地址。
- `format`：适配器类型，目前仅支持 `maccms-v10`。
- `isEnabled`：是否参与聚合；失效或返回非 JSON 的来源应设为 `false`。

## 统一视频模型

前端不直接消费 `vod_*` 字段，而是统一映射成：

```js
{
  key, sourceId, sourceName, id,
  title, poster, type, typeId,
  year, area, language, remark, score,
  actors, director, content, updatedAt,
  episodes: [{ name, url, source }]
}
```

详情键使用 `sourceId:vodId`，避免不同数据源使用相同 `vod_id` 时互相覆盖。

## 运行与部署

项目目录按职责划分：

```text
src/site/      静态站点源码和数据源配置
src/worker/    Cloudflare Worker 网关
scripts/       构建与维护脚本
types/         Wrangler 生成的绑定类型
docs/          项目文档
public/        构建产物（不提交）
```

```sh
npm install
npm run dev
```

本地开发由 Wrangler 同时提供静态资源和 `/api/vod`。部署前执行 `npm run check`，部署到 Cloudflare Workers 执行 `npm run deploy`。

如果继续使用 GitHub Pages，可以发布 `npm run build` 生成的 `public/` 目录，但数据请求将依赖回退代理。
