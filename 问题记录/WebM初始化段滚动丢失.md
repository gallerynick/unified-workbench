# WebM 初始化段滚动丢失（新观看者永远黑屏）

## 问题分类
WebSocket / MediaSource / 推流

## 触发场景
直播推流运行一段时间后（超过 100 个 chunk），新加入的观看者页面永远黑屏/转圈，无法播放。

## 根因
后端 relay 使用 **100 帧滚动缓冲区**（`room["buffer"]`）。

推流持续超过 100 个 chunk 后，第一个 chunk（WebM 初始化段 = EBML header + Segment header + Tracks info）被后续 chunk 挤出缓冲区。

新订阅者收到的第一个 chunk **不包含文件头**，MediaSource 无法初始化解码器 → 永远黑屏。

```
Buffer: [C1, C2, C3, ..., C100, C101, C102, ...]
         ↑ 初始化段           ↑ 新chunk进来，C1被挤出
         
新订阅者收到: [C101, C102, ...]
但 C101 只是普通数据块，无 EBML/Segment/Tracks → MediaSource.addSourceBuffer() 失败
```

## 修复方案
新增 `init_segment` 字段保存第一个 chunk，新订阅者加入时检查并前置：

```python
# relay() 中保存初始化段
if not room.get("init_segment"):
    room["init_segment"] = chunk  # 第一个 chunk = WebM 初始化段

# add_subscriber() 中前置初始化段
def add_subscriber(room, subscriber):
    buffer = room["buffer"]
    init = room.get("init_segment")
    if init and buffer and buffer[0] != init:
        buffer.insert(0, init)  # 初始化段已滚出，重新前置
```

## 易错点
- WebM 初始化段是固定内容，不需要每个 chunk 都包含，但必须是新观看者的第一个 chunk
- 检查 `buffer[0] != init` 用引用/内容比较，避免每次都重复插入
- 滚动缓冲区的大小要权衡内存和观看者体验：太大会占内存，太小会频繁丢失初始化段
