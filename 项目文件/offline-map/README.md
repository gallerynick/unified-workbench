# 中国全境离线街道地图

基于 OpenStreetMap 数据的中国全境离线街道地图网站，完全离线运行，无需外网连接。

## 技术栈

| 组件 | 技术 | 许可 |
|------|------|------|
| 瓦片数据 | OpenStreetMap | ODbL |
| 矢量瓦片 | OpenMapTiles | BSD |
| 前端渲染 | MapLibre GL JS | MIT |
| 瓦片服务 | TileServer-GL | BSD |

## 快速部署

### 1. 准备地图数据

将中国全境 `.mbtiles` 文件放入 `data/` 目录：

```bash
# 方法一：使用 tilemaker 生成（推荐）
# 下载中国 OSM 数据
wget https://download.geofabrik.de/asia/china-latest.osm.pbf

# 使用 tilemaker 生成 mbtiles（Z0-Z14）
tilemaker --input china-latest.osm.pbf --output data/china.mbtiles \
  --config /path/to/config.json --process /path/to/process.lua

# 方法二：下载预构建的 mbtiles
# 从 OpenMapTiles 或其他来源下载中国区域的 mbtiles 文件
# 放入 data/ 目录并重命名为 china.mbtiles
```

### 2. 启动服务

```bash
docker-compose up -d
```

### 3. 访问地图

- 地图前端：http://localhost:8090
- TileServer-GL 管理界面：http://localhost:8080

## 项目结构

```
offline-map/
├── docker-compose.yml      # Docker Compose 配置
├── data/
│   └── china.mbtiles       # 地图瓦片数据（需自行生成/下载）
├── www/
│   └── index.html          # 前端页面
└── README.md               # 本文件
```

## 功能特性

- ✅ 中国全境 Z0-Z14 缩放级别
- ✅ 中文地名标注
- ✅ 完全离线运行
- ✅ 获取当前位置（需浏览器授权）
- ✅ 响应式设计
- ✅ 完整 OSM 署名

## 自定义

### 修改中心点

编辑 `www/index.html`，修改 `center` 参数：

```javascript
center: [116.397, 39.908],  // 北京
// 改为其他城市，如上海：
center: [121.473, 31.230],
```

### 裁剪特定省份

使用 osmium 工具裁剪特定省份数据：

```bash
# 安装 osmium
apt-get install osmium-tool

# 裁剪四川省数据
osmium extract -b 97.35,26.03,108.53,34.32 china-latest.osm.pbf -o sichuan.osm.pbf

# 生成四川省 mbtiles
tilemaker --input sichuan.osm.pbf --output data/sichuan.mbtiles
```

省份边界坐标可在 [GeoNames](http://www.geonames.org/) 查询。

## 署名要求

本项目使用 OpenStreetMap 数据，根据 ODbL 许可要求，必须保留以下署名：

> © OpenStreetMap contributors

此署名已包含在：
- 前端页面（index.html）
- TileServer-GL 默认样式
- 本 README 文件

## 许可证

- 地图数据：[ODbL](https://opendatacommons.org/licenses/odbl/)
- MapLibre GL JS：[MIT](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt)
- TileServer-GL：[BSD](https://github.com/maptiler/tileserver-gl/blob/master/LICENSE)
- 本项目代码：MIT
