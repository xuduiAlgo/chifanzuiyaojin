# 连续上传ASR进度误判修复 - Task ID追踪方案

## 问题描述

用户反馈：连续上传音视频文件时，第二次上传开始时就显示90%进度，这是因为它读取到了之前任务的日志，无法区分不同的ASR任务。

## 根本原因

之前的实现没有**任务隔离机制**：
- 日志解析器读取的是所有日志，不区分是哪个任务的
- 当连续上传时，新任务的进度追踪器会读取到旧任务的日志
- 导致第二次上传一开始就显示旧任务的进度（如90%）

## 解决方案：Task ID追踪机制

### 核心思路

为每个ASR请求生成唯一的任务ID（UUID），所有相关日志都包含该ID，前端只解析包含当前任务ID的日志。

### 实现细节

#### 1. 服务器端（server.py）

**生成唯一任务ID**：
```python
import uuid

@app.route('/api/asr', methods=['POST'])
def api_asr():
    # Generate unique task ID for this ASR request
    task_id = str(uuid.uuid4())
    print(f"ASR Request [Task ID: {task_id}]: Starting new ASR task", file=sys.stderr)
    
    # ... 处理文件 ...
    
    # 传递task_id给run_ali_asr
    ok, res = run_ali_asr(input_path, key, task_id)
    
    # 返回task_id给前端
    return jsonify({
        "ok": True,
        "task_id": task_id,  # ← 返回任务ID
        "audio_url": f"/tts_output/{saved_filename}",
        ...
    })
```

**所有日志都包含Task ID**：
```python
def run_ali_asr(file_path, api_key, task_id):
    """Run ASR with task ID for progress tracking"""
    print(f"ASR [Task ID: {task_id}]: Starting ASR processing", file=sys.stderr)
    
    # 分片处理
    for i, chunk in enumerate(chunks):
        print(f"ASR [Task ID: {task_id}]: Processing chunk {i+1}/{len(chunks)}...", file=sys.stderr)
        ok, res = _call_qwen_audio(chunk, task_id)
    
def _call_qwen_audio(audio_path, task_id):
    """Call Qwen Audio API with task ID"""
    for model_name in MODEL_ASR_LIST:
        print(f"ASR [Task ID: {task_id}]: Trying model: {model_name}", file=sys.stderr)
        print(f"ASR [Task ID: {task_id}]: DEBUG: Starting stream for {model_name}", file=sys.stderr)
        print(f"ASR [Task ID: {task_id}]: DEBUG: Stream finished. Content len: {len(full_content)}", file=sys.stderr)
```

#### 2. 前端传递Task ID（app.js）

**接收并设置Task ID**：
```javascript
async function startAsr() {
    // ... 创建tracker ...
    const asrTracker = window.ProgressTracker.createASRTracker({...});
    asrTracker.start();
    
    // 发送请求
    const res = await fetch("/api/asr", { method: "POST", body: form });
    const data = await res.json();
    
    // 获取服务器返回的task_id
    const taskId = data.task_id;
    console.log('ASR Task ID:', taskId);
    
    // 更新tracker的taskId以过滤日志
    if (taskId && asrTracker.setTaskId) {
        asrTracker.setTaskId(taskId);  // ← 设置任务ID
    }
    
    // 停止追踪
    asrTracker.stop();
}
```

#### 3. 进度追踪器过滤日志（progress-tracker.js）

**添加taskId支持和过滤**：
```javascript
let taskId = null; // 任务ID，用于过滤日志

/**
 * 获取日志
 */
async function fetchLogs() {
    try {
        let url = '/api/logs?lines=50';
        // 如果有taskId，添加filter参数来过滤日志
        if (taskId) {
            url += `&filter=Task ID: ${taskId}`;  // ← 使用filter参数
        }
        const response = await fetch(url);
        const data = await response.json();
        return data.ok ? data.logs : [];
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        throw error;
    }
}

/**
 * 轮询一次
 */
async function pollOnce() {
    // 获取日志（已过滤）
    const logs = await fetchLogs();
    
    // 解析日志获取进度（传递taskId用于验证）
    const parsed = window.LogParser.parseLogs(logs, type, taskId);  // ← 传递taskId
    
    // ... 更新进度 ...
}

/**
 * 设置任务ID（用于过滤日志）
 */
function setTaskId(newTaskId) {
    if (newTaskId && newTaskId !== taskId) {
        console.log(`Setting task ID: ${newTaskId}`);
        taskId = newTaskId;
        // 重置错误计数，因为现在开始读取新的日志
        consecutiveErrors = 0;
    }
}

return {
    start,
    stop,
    reset,
    getStatus,
    setTaskId  // ← 导出setTaskId方法
};
```

#### 4. 日志解析器过滤Task ID（log-parser.js）

**只解析包含指定Task ID的日志**：
```javascript
/**
 * 从日志行数组中解析ASR/TTS进度
 * @param {Array<string>} logs - 日志行数组
 * @param {string} type - 'ASR' 或 'TTS'
 * @param {string} taskId - 任务ID，用于过滤日志（可选）
 * @returns {Object} 解析结果
 */
parseLogs(logs, type = 'ASR', taskId = null) {
    // ... 初始化变量 ...
    
    for (let i = logs.length - 1; i >= 0; i--) {
        const line = logs[i].trim();
        if (!line) continue;
        
        // 跳过HTTP访问日志
        if (line.includes('GET /api/logs') || line.includes('HTTP/1.1')) {
            continue;
        }
        
        // 如果指定了taskId，只处理包含该taskId的日志行
        if (taskId && !line.includes(`Task ID: ${taskId}`)) {  // ← 关键过滤
            continue;
        }
        
        // ... 解析进度 ...
    }
    
    return {
        progress: currentProgress,
        status: currentStatus,
        event: currentEvent
    };
}
```

## 工作流程

### 第一次上传

1. **服务器生成Task ID**：`uuid-1234`
2. **前端开始追踪**：`asrTracker.start()`（taskId=null）
3. **前端收到Task ID**：`asrTracker.setTaskId('uuid-1234')`
4. **日志轮询**：
   - 第1次：没有找到包含`Task ID: uuid-1234`的日志 → 进度0%
   - 第2次：找到`ASR [Task ID: uuid-1234]: Processing chunk 1/5` → 进度20%
   - ...
   - 第N次：找到`ASR [Task ID: uuid-1234]: Processing chunk 5/5` → 进度90%
   - 第N+1次：找到`POST /api/asr HTTP/1.1 200` → 进度100%

### 第二次上传（连续上传）

1. **服务器生成新Task ID**：`uuid-5678`
2. **前端开始追踪**：`asrTracker.start()`（taskId=null）
3. **前端收到新Task ID**：`asrTracker.setTaskId('uuid-5678')`
4. **日志轮询**：
   - 第1次：没有找到包含`Task ID: uuid-5678`的日志 → 进度0% ✅
     - 即使日志中包含`Task ID: uuid-1234`的旧日志，也会被过滤掉
   - 第2次：找到`ASR [Task ID: uuid-5678]: Processing chunk 1/3` → 进度20%
   - ...

## 过滤机制说明

### 服务器端日志过滤（可选）

`/api/logs`接口支持`filter`参数：
```javascript
fetch('/api/logs?lines=50&filter=Task ID: uuid-1234')
```

服务器会使用正则表达式过滤只包含指定字符串的日志：
```python
if filter_pattern:
    try:
        import re
        regex = re.compile(filter_pattern, re.IGNORECASE)
        time_filtered_lines = [line for line in time_filtered_lines if regex.search(line)]
    except re.error:
        pass  # 无效的regex，返回所有行
```

### 前端日志解析过滤（必需）

即使服务器没有过滤（因为服务器是在ASR开始时才知道task_id），前端也会在解析时过滤：

```javascript
// 如果指定了taskId，只处理包含该taskId的日志行
if (taskId && !line.includes(`Task ID: ${taskId}`)) {
    continue;  // 跳过不包含当前task ID的日志行
}
```

## 日志示例

### 第一次上传（Task ID: abc123）

```
2026-01-18 09:30:00 - INFO - ASR Request [Task ID: abc123]: Starting new ASR task
2026-01-18 09:30:05 - INFO - ASR [Task ID: abc123]: Starting ASR processing
2026-01-18 09:30:06 - INFO - ASR [Task ID: abc123]: Audio too long (1414.96s), splitting...
2026-01-18 09:30:07 - INFO - ASR [Task ID: abc123]: Processing chunk 1/5...
2026-01-18 09:30:22 - INFO - ASR [Task ID: abc123]: DEBUG: Starting stream for qwen3-omni-flash-2025-12-01
2026-01-18 09:30:45 - INFO - ASR [Task ID: abc123]: DEBUG: Stream finished. Content len: 1603
2026-01-18 09:30:46 - INFO - ASR [Task ID: abc123]: Processing chunk 2/5...
...
2026-01-18 09:32:18 - INFO - POST /api/asr HTTP/1.1 200
```

### 第二次上传（Task ID: def456）

```
2026-01-18 09:33:00 - INFO - ASR Request [Task ID: def456]: Starting new ASR task
2026-01-18 09:33:05 - INFO - ASR [Task ID: def456]: Starting ASR processing
2026-01-18 09:33:06 - INFO - ASR [Task ID: def456]: Processing chunk 1/3...
...
```

**前端日志解析**：
- 第一次上传时，只解析包含`Task ID: abc123`的日志
- 第二次上传时，只解析包含`Task ID: def456`的日志
- 两个任务的日志互不干扰

## 优势

1. **任务隔离**：每个ASR任务有独立的追踪，不会相互干扰
2. **准确的进度显示**：新任务不会读取到旧任务的进度
3. **向后兼容**：如果不提供taskId，仍然可以工作（读取所有日志）
4. **调试友好**：日志中包含Task ID，方便追踪特定任务的处理过程
5. **灵活过滤**：支持在服务器端和前端两处过滤，确保准确性

## 测试场景

### 场景1：单次上传

**预期结果**：
- 正常显示进度从0%到100%
- 日志中包含唯一的Task ID

### 场景2：连续上传（问题场景）

**操作步骤**：
1. 上传第一个长视频（需要分片）
2. 等待完成
3. 立即上传第二个视频

**预期结果**：
- 第二个上传开始时进度显示0% ✅（而不是90%）
- 进度正常从0%增长到100%
- 不会读取到第一个任务的日志

### 场景3：并行上传（高级场景）

**操作步骤**：
1. 快速连续上传两个视频（可能部分重叠）

**预期结果**：
- 每个任务有独立的Task ID
- 每个任务的进度追踪器只读取自己Task ID的日志
- 进度显示互不干扰

## 相关文件

- `server.py`：服务器端，生成Task ID并在日志中记录
- `app.js`：前端，接收Task ID并设置到tracker
- `js/progress-tracker.js`：进度追踪器，使用Task ID过滤日志请求
- `js/log-parser.js`：日志解析器，只解析包含指定Task ID的日志
- `index.html`：添加版本号参数强制刷新浏览器缓存

## 注意事项

1. **Task ID的时机**：
   - Task ID是在服务器收到请求时生成的
   - 前端在收到服务器响应后才获得Task ID
   - 因此前几次轮询可能没有进度，这是正常的

2. **日志轮询间隔**：
   - 默认为1秒
   - 在收到Task ID后才会开始过滤日志
   - 建议不要设置过短的轮询间隔

3. **浏览器缓存**：
   - 已在HTML中添加版本号参数：`?v=20250118`
   - 强制浏览器下载最新的JavaScript文件
   - 避免使用缓存的旧版本代码

## 总结

通过引入Task ID追踪机制，我们实现了：

✅ **任务隔离**：每个ASR任务有唯一标识
✅ **准确进度**：新任务不会读取旧任务日志
✅ **连续上传支持**：支持连续快速上传多个文件
✅ **调试友好**：日志包含Task ID，便于追踪
✅ **向后兼容**：不影响现有的单次上传功能

这个方案彻底解决了连续上传时进度显示错误的问题，用户体验得到显著改善。
