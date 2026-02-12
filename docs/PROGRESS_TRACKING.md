# 进度追踪功能文档

## 概述

本系统实现了基于实际日志分析的ASR和TTS进度追踪功能，通过解析服务器日志中的关键事件来提供更准确的进度百分比。

## 工作原理

### 1. 日志解析器 (js/log-parser.js)

日志解析器负责从服务器日志中提取关键事件并计算进度百分比。

#### 支持的日志事件

**ASR（语音识别）事件：**
- `Audio too long (Xs), splitting...` - 音频分片开始，进度：10%
- `Processing chunk X/Y...` - 分片处理中，进度：10% + (X/Y × 70%)
- `Trying model: qwen3-omni-flash-2025-12-01` - 模型调用，进度：90%
- `ASR completed successfully` - 转写完成，进度：100%

**TTS（语音合成）事件：**
- `Starting TTS generation` - 开始生成，进度：10%
- `Sending request to Qwen-TTS API` - 发送请求，进度：30%
- `Processing TTS response` - 处理响应，进度：70%
- `TTS generation completed` - 生成完成，进度：100%

### 2. 进度追踪管理器 (js/progress-tracker.js)

进度追踪管理器提供了完整的进度追踪功能，包括：

- **日志轮询**：定期从服务器获取最新日志
- **进度计算**：基于日志事件计算进度百分比
- **降级模式**：当日志解析失败时，自动切换到基于时间的估算
- **错误处理**：网络错误重试机制
- **超时保护**：防止无限等待

### 3. 后端日志接口 (server.py)

服务器提供 `/api/logs` 接口，返回最近的日志行：

```python
@app.route('/api/logs', methods=['GET'])
def get_logs():
    """获取最近的日志行"""
    lines = int(request.args.get('lines', 50))
    log_file = 'logs/server.log'
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            all_logs = f.readlines()
            recent_logs = all_logs[-lines:]
        return jsonify({'ok': True, 'logs': recent_logs})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})
```

## 使用方法

### 前端集成

在ASR或TTS功能中创建进度追踪器：

```javascript
// 创建ASR进度追踪器
const asrTracker = window.ProgressTracker.createASRTracker({
    estimatedDuration: 60000, // 预估时长(毫秒)
    onProgress: (progress, status) => {
        console.log(`进度: ${progress}%, 状态: ${status}`);
        // 更新UI进度条
        updateProgressBar(progress, status);
    },
    onComplete: (success, result) => {
        console.log('追踪完成:', result);
    }
});

// 开始追踪
asrTracker.start();

// 任务完成后停止追踪
asrTracker.stop();
```

### TTS集成示例

```javascript
async function generateAudio() {
    const text = ui.text.value.trim();
    
    // 显示初始进度
    updateProgress('tts', 5, "正在准备生成...");
    
    // 创建TTS进度追踪器
    const ttsTracker = window.ProgressTracker.createTTSTracker({
        estimatedDuration: Math.max(30000, text.length * 50),
        onProgress: (progress, status) => {
            updateProgress('tts', progress, status);
        },
        onComplete: (success, result) => {
            if (result.usingFallback) {
                console.log('使用了降级估算模式');
            }
        }
    });
    
    ttsTracker.start();
    
    try {
        // 发送TTS请求
        const res = await fetch("/api/tts", {...});
        const data = await res.json();
        
        // 停止进度追踪
        ttsTracker.stop();
        
        // 更新为100%
        updateProgress('tts', 100, "生成完成！");
    } catch (e) {
        ttsTracker.stop();
        hideProgress('tts');
    }
}
```

### ASR集成示例

```javascript
async function startAsr() {
    const file = ui.asrFile.files[0];
    
    // 显示初始进度
    updateProgress('asr', 5, "正在准备上传...");
    
    // 创建ASR进度追踪器
    const asrTracker = window.ProgressTracker.createASRTracker({
        estimatedDuration: Math.max(60000, file.size / 100000 * 60),
        onProgress: (progress, status) => {
            updateProgress('asr', progress, status);
        },
        onComplete: (success, result) => {
            console.log('ASR追踪完成:', result);
        }
    });
    
    asrTracker.start();
    
    try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/asr", { method: "POST", body: form });
        const data = await res.json();
        
        // 停止进度追踪
        asrTracker.stop();
        
        // 更新为100%
        updateProgress('asr', 100, "转写完成！");
    } catch (e) {
        asrTracker.stop();
        hideProgress('asr');
    }
}
```

## 配置选项

### ProgressTracker.createTracker(options)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | string | 'ASR' | 任务类型：'ASR' 或 'TTS' |
| `pollInterval` | number | 1000 | 轮询间隔（毫秒） |
| `estimatedDuration` | number | 60000 | 预估总时长（毫秒），用于降级模式 |
| `onProgress` | function | null | 进度回调函数 |
| `onComplete` | function | null | 完成回调函数 |
| `onError` | function | null | 错误回调函数 |
| `maxRetries` | number | 3 | 最大重试次数 |
| `useFallback` | boolean | true | 是否启用降级模式 |

### 便捷方法

```javascript
// 创建ASR进度追踪器
const asrTracker = window.ProgressTracker.createASRTracker(options);

// 创建TTS进度追踪器
const ttsTracker = window.ProgressTracker.createTTSTracker(options);
```

## 降级模式

当日志解析失败时（例如日志接口不可用或日志格式变化），系统会自动切换到降级模式：

1. **触发条件**：
   - 连续 `maxRetries` 次日志获取失败
   - 日志解析器无法识别任何事件

2. **降级行为**：
   - 停止日志轮询
   - 基于预估时长计算进度
   - 线性增长：`progress = (elapsedTime / estimatedDuration) * 100`

3. **优势**：
   - 确保进度条始终有反馈
   - 避免用户长时间等待
   - 系统更加健壮

## 日志格式要求

服务器日志需要包含特定的关键词才能被正确解析：

### ASR日志格式
```
[2024-01-17 22:00:00] INFO: Audio too long (1414.96s), splitting...
[2024-01-17 22:00:01] INFO: Processing chunk 1/5...
[2024-01-17 22:00:02] INFO: Processing chunk 2/5...
[2024-01-17 22:00:03] INFO: Processing chunk 3/5...
[2024-01-17 22:00:04] INFO: ASR Trying model: qwen3-omni-flash-2025-12-01
[2024-01-17 22:00:05] INFO: ASR completed successfully
```

### TTS日志格式
```
[2024-01-17 22:00:00] INFO: Starting TTS generation
[2024-01-17 22:00:01] INFO: Sending request to Qwen-TTS API
[2024-01-17 22:00:02] INFO: Processing TTS response
[2024-01-17 22:00:03] INFO: TTS generation completed
```

## 调试和监控

### 控制台日志

进度追踪器会在控制台输出详细日志：

```javascript
// 开启调试模式
console.log('Tracker status:', asrTracker.getStatus());

// 状态信息包含：
{
    isRunning: true,
    lastProgress: 45,
    consecutiveErrors: 0,
    usingFallback: false,
    elapsed: 2500
}
```

### 常见问题

**Q: 进度条卡在某个百分比不动？**

A: 可能原因：
1. 日志接口不可用 - 检查网络连接
2. 日志格式变化 - 检查服务器日志
3. 任务实际执行时间过长 - 等待任务完成

**Q: 降级模式是什么意思？**

A: 降级模式是当日志解析失败时的备用方案，使用基于时间的估算来更新进度条，确保用户始终能看到进度反馈。

**Q: 如何调整进度更新的频率？**

A: 修改 `pollInterval` 参数（默认1000毫秒）：
```javascript
const tracker = window.ProgressTracker.createASRTracker({
    pollInterval: 500, // 每500毫秒更新一次
    ...
});
```

## 性能考虑

1. **轮询间隔**：默认1秒，可根据需要调整
2. **日志数量**：每次获取最近50行，避免过多数据传输
3. **进度防抖**：相同百分比不会重复触发回调
4. **资源清理**：完成后自动停止轮询，释放资源

## 未来扩展

1. 支持更多日志事件类型
2. 可配置的进度映射规则
3. WebSocket实时日志推送（替代轮询）
4. 更精确的预估算法
5. 多任务并发追踪

## 总结

基于日志的进度追踪系统通过解析实际的服务器日志事件，为用户提供更准确、更真实的进度反馈。系统包含完善的降级机制和错误处理，确保在各种情况下都能提供良好的用户体验。
