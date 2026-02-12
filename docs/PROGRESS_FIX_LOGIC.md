# ASR进度追踪100%误判修复文档

## 问题描述

在ASR分片处理过程中，进度追踪会在处理到第6个分片时误判为100%完成，而实际还有2个分片（共8个）未处理。

## 问题根源

### 原始逻辑缺陷

```javascript
// 错误的逻辑：只要看到"POST /api/asr" 200就判定完成
if (isChunkedMode && foundLastChunk && 
    line.includes('POST /api/asr') && line.includes('200')) {
    currentProgress = 100;
}
```

**问题**：在分片模式下，每个chunk处理完成后都有一个POST请求返回200状态码。当反向遍历日志时，在第6个chunk的POST请求出现时：
- `foundLastChunk`在匹配到"Processing chunk 6/8..."时被错误地设置为true
- 实际上第6个chunk并不是最后一个chunk（第8个才是）

### 日志流程分析

```
2026-01-18 09:12:10 - Processing chunk 6/8...
2026-01-18 09:12:10 - ASR Trying model: qwen3-omni-flash-2025-12-01
2026-01-18 09:12:25 - DEBUG: Stream finished. Content len: 1481
2026-01-18 09:12:25 - POST /api/asr HTTP/1.1 200 -  ← 这里被误判为100%
2026-01-18 09:12:25 - Processing chunk 7/8...
2026-01-18 09:12:44 - Processing chunk 8/8...  ← 真正的最后一个chunk
2026-01-18 09:12:46 - DEBUG: Stream finished. Content len: 68
2026-01-18 09:12:56 - POST /api/asr HTTP/1.1 200 -  ← 真正的完成
```

## 修复方案

### 新增标志位

```javascript
let foundLastChunk = false;      // 是否找到了最后一个chunk（current === total）
let lastChunkFinished = false;   // 最后一个chunk是否已经Stream finished
```

### 修复后的完整判断逻辑

```javascript
// 1. 匹配到"Processing chunk 6/8..."
//    foundLastChunk = false (因为 6 !== 8)
//    lastChunkFinished = false

// 2. 匹配到"Processing chunk 8/8..."
//    foundLastChunk = true (因为 8 === 8)
//    lastChunkFinished = false

// 3. 匹配到"Stream finished"
//    if (foundLastChunk) {
//        lastChunkFinished = true;  // 只有最后一个chunk的Stream finished才会设置
//    }

// 4. 严格的三重判断条件
if (isChunkedMode && foundLastChunk && lastChunkFinished &&
    line.includes('POST /api/asr') && line.includes('200')) {
    currentProgress = 100;
    currentStatus = '完成';
    currentEvent = 'COMPLETE';
}
```

### 关键修复点

1. **精确识别最后一个chunk**：只有当`currentChunk === totalChunks`时才设置`foundLastChunk = true`

2. **跟踪最后一个chunk的完成状态**：只有最后一个chunk的"Stream finished"才会设置`lastChunkFinished = true`

3. **三重验证**：
   - `isChunkedMode`：确保是分片模式
   - `foundLastChunk`：已经找到了最后一个chunk
   - `lastChunkFinished`：最后一个chunk已经Stream finished
   - `POST /api/asr 200`：最终的POST请求返回

## 进度映射表

### 分片模式（8个分片示例）

| 日志内容 | 进度 | 状态 | 说明 |
|---------|------|------|------|
| "Audio too long (2117.08s), splitting..." | 10% | 正在分割音频... | 开始分片 |
| "Processing chunk 1/8..." | 20% | 正在处理分片 1/8... | 10 + (1/8 × 80) |
| "Processing chunk 2/8..." | 30% | 正在处理分片 2/8... | 10 + (2/8 × 80) |
| "Processing chunk 6/8..." | 70% | 正在处理分片 6/8... | 10 + (6/8 × 80) |
| "Processing chunk 8/8..." | 90% | 正在处理分片 8/8... | 10 + (8/8 × 80) |
| "Stream finished" (chunk 8) | 90% | 正在处理结果... | 最后chunk完成 |
| "POST /api/asr" 200 | 100% | 完成 | 三重条件满足 |

### 不分片模式

| 日志内容 | 进度 | 状态 | 说明 |
|---------|------|------|------|
| "ASR Trying model: ..." | 20% | 正在调用模型... | 开始处理 |
| "DEBUG: Starting stream for ..." | 40% | 正在接收流式数据... | 流式传输开始 |
| "DEBUG: Stream finished..." | 90% | 正在处理结果... | 流式传输完成 |
| "ASR completed successfully" | 100% | 完成 | 直接匹配 |

## 测试验证

### 测试用例1：分片模式中途
**输入日志**：
```
Processing chunk 6/8...
Stream finished
POST /api/asr 200
```

**预期结果**：
- `foundLastChunk = false`（6 !== 8）
- `lastChunkFinished = false`
- 进度：70%（不会误判为100%）

### 测试用例2：分片模式完成
**输入日志**：
```
Processing chunk 8/8...
Stream finished
POST /api/asr 200
```

**预期结果**：
- `foundLastChunk = true`（8 === 8）
- `lastChunkFinished = true`
- 进度：100%（正确判断）

### 测试用例3：不分片模式
**输入日志**：
```
ASR Trying model: qwen3-omni-flash-2025-12-01
Stream finished
POST /api/asr 200
```

**预期结果**：
- `isChunkedMode = false`
- 使用不分片模式逻辑
- 进度：90%（Stream finished）

## 总结

通过引入`lastChunkFinished`标志位和严格的三重条件判断，确保了ASR进度追踪的准确性：

1. **避免提前判定**：在chunk 6处理完成时不会误判为100%
2. **精确完成时机**：只有在最后一个chunk真正完成后才显示100%
3. **兼容两种模式**：分片模式和不分片模式都能正确工作
4. **用户体验提升**：用户能够看到真实的处理进度，避免误以为任务已完成

## 相关文件

- `js/log-parser.js`：日志解析器，包含修复后的进度判断逻辑
- `js/progress-tracker.js`：进度追踪器，调用log-parser解析进度
- `server.py`：后端服务器，处理ASR请求并生成日志
