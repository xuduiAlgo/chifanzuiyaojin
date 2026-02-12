# 离线导出功能调试指南

## 问题描述
用户反馈：先点击下载视频，下载正确。再点击下载音频，下载的还是视频一样大小，只是没有视频界面。

## 调试步骤

### 1. 清除浏览器缓存并刷新
在测试前，**必须强制刷新浏览器**以加载最新的 JavaScript 代码：

- **Windows/Linux**: 按 `Ctrl + Shift + R`
- **Mac**: 按 `Cmd + Shift + R`

### 2. 打开浏览器开发者工具
1. 在浏览器中按 `F12` 打开开发者工具
2. 点击 **Console**（控制台）标签
3. 保持控制台窗口打开

### 3. 进行测试操作
1. 打开 ASR 视频文件的历史记录详情
2. 选择"包含视频"，点击导出
3. 查看控制台输出的日志
4. 选择"仅音频"，再次点击导出
5. 再次查看控制台输出的日志

### 4. 查看关键日志信息

#### 预期的日志输出（选择"仅音频"时）：
```
=== exportASRHistory START ===
Export mode: audio
File type: video
Original audio URL: /tts_output/asr-xxx.mp4
>>> Audio extraction needed
>>> Calling audio extraction API...
>>> Original video URL: /tts_output/asr-xxx.mp4
>>> API response: {ok: true, audio_url: "/tts_output/asr-xxx-audio.mp3", audio_size: 123456, video_size: 987654}
>>> Audio extracted successfully!
>>> Extracted audio URL: /tts_output/asr-xxx-audio.mp3
>>> Audio file size: 123456 Video file size: 987654
>>> Final audio URL after extraction: /tts_output/asr-xxx-audio.mp3
>>> Converting to base64...
>>> Converting URL: /tts_output/asr-xxx-audio.mp3
>>> Base64 conversion completed, length: 1234567
>>> Generating HTML with exportMode: audio
```

#### 预期的日志输出（选择"包含视频"时）：
```
=== exportASRHistory START ===
Export mode: video
File type: video
Original audio URL: /tts_output/asr-xxx.mp4
>>> Audio extraction NOT needed (either not video or exportMode is video)
>>> Converting to base64...
>>> Converting URL: /tts_output/asr-xxx.mp4
>>> Base64 conversion completed, length: 9876543
>>> Generating HTML with exportMode: video
```

### 5. 检查可能出现的问题

#### 问题 A：音频提取失败
**日志特征**：
```
Failed to extract audio: [错误信息]
```
**原因**：服务器端的音频提取功能可能有问题

**解决方法**：
1. 检查服务器日志：`tail -f logs/server.log`
2. 查看是否有音频提取相关的错误
3. 检查 `/api/extract-audio` 端点是否正常工作

#### 问题 B：提取的音频URL和视频URL相同
**日志特征**：
```
ERROR: Extracted audio URL is same as video URL!
```
**原因**：服务器返回的音频URL与输入的视频URL相同，说明提取失败

**解决方法**：
检查服务器端的 `/api/extract-audio` 实现，确保它正确提取音频并返回新的URL

#### 问题 C：没有调用音频提取API
**日志特征**：
```
>>> Audio extraction NOT needed (either not video or exportMode is video)
```
**原因**：
- `fileType` 不是 'video'
- 或者 `exportMode` 不是 'audio'

**解决方法**：
1. 检查历史记录中的 `fileType` 字段是否正确设置为 'video'
2. 检查 `exportMode` 参数是否正确传递为 'audio'
3. 在 `app.js` 的导出按钮点击事件中，查看日志：
   ```
   Export mode selected: audio
   Exporting with mode: audio for record: xxx.mp4
   ```

#### 问题 D：base64转换后大小没有变化
**日志特征**：
```
>>> Base64 conversion completed, length: 9876543
```
但这个长度和视频文件的base64长度一样大。

**原因**：音频提取可能没有成功，或者提取的音频URL仍然指向视频文件

**解决方法**：
1. 检查 `data.audio_url` 和 `originalAudioUrl` 是否不同
2. 直接在浏览器中访问提取的音频URL，确认它是一个独立的音频文件

### 6. 手动测试音频提取API

在浏览器控制台中执行以下代码来测试音频提取API：

```javascript
// 替换为你的视频URL
const videoUrl = '/tts_output/asr-xxx.mp4';

fetch('/api/extract-audio', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({video_url: videoUrl})
})
.then(res => res.json())
.then(data => {
    console.log('音频提取结果:', data);
    console.log('原始URL:', videoUrl);
    console.log('提取后的URL:', data.audio_url);
    console.log('是否相同:', data.audio_url === videoUrl);
    console.log('音频大小:', data.audio_size, '字节');
    console.log('视频大小:', data.video_size, '字节');
})
.catch(err => console.error('错误:', err));
```

### 7. 验证导出的HTML文件

#### 方法1：查看源代码
1. 打开下载的HTML文件
2. 右键 -> 查看页面源代码
3. 搜索 `<audio>` 或 `<video>` 标签
4. 查看播放器类型是否正确

#### 方法2：检查base64数据前缀
在HTML源代码中找到播放器的 `src` 属性：

- **音频文件**：应该以 `data:audio/mpeg;base64,` 或 `data:audio/wav;base64,` 开头
- **视频文件**：应该以 `data:video/mp4;base64,` 开头

### 8. 常见问题和解决方案

#### 问题：每次导出都是视频
**可能原因**：
1. 浏览器缓存了旧的JavaScript代码
2. 历史记录的 `fileType` 字段不正确

**解决方法**：
1. 强制刷新浏览器（Ctrl+Shift+R）
2. 检查历史记录数据的 `fileType` 字段
3. 重新上传视频文件进行转写

#### 问题：音频提取后大小没有变化
**可能原因**：
1. 服务器端的音频提取功能返回了原始视频URL
2. 音频提取失败但没有报错

**解决方法**：
1. 检查服务器日志：`tail -f logs/server.log`
2. 手动测试音频提取API（见第6步）
3. 检查服务器端的音频提取实现

#### 问题：导出选项没有显示
**可能原因**：
1. `fileType` 不是 'video'
2. 历史记录是旧数据

**解决方法**：
1. 重新转写一个视频文件
2. 检查历史记录中的 `fileType` 字段

### 9. 收集诊断信息

如果问题仍然存在，请收集以下信息：

1. **浏览器控制台日志**（完整的导出过程）
2. **服务器日志**（导出期间的日志）
3. **历史记录数据**（在控制台中执行）：
   ```javascript
   console.log(JSON.parse(localStorage.getItem('asr_history'))[0]);
   ```
4. **音频提取API测试结果**（见第6步）

## 下一步

根据收集的日志信息，我们可以：
1. 确定问题是在前端还是后端
2. 找出具体的失败原因
3. 实施针对性的修复

## 技术说明

### 导出流程

1. **用户选择导出模式**：audio 或 video
2. **检查是否需要提取音频**：
   - 如果 `fileType === 'video'` 且 `exportMode === 'audio'`，需要提取音频
   - 否则，直接使用原始URL
3. **调用音频提取API**（如果需要）
4. **转换为base64**：将媒体文件转换为base64编码
5. **生成HTML**：根据 `exportMode` 决定使用 `<audio>` 还是 `<video>` 标签
6. **下载文件**

### 关键代码位置

- **导出按钮事件处理**：`app.js` 中的 `openHistoryDetail` 函数
- **导出逻辑**：`js/offline-exporter.js` 中的 `exportASRHistory` 函数
- **音频提取API**：`server.py` 中的 `/api/extract-audio` 端点
- **HTML生成**：`js/offline-exporter.js` 中的 `generateHTML` 函数

### 日志说明

添加的日志会显示：
- ✅ 导入的参数值
- ✅ 是否需要提取音频
- ✅ 音频提取API的请求和响应
- ✅ 提取后的URL和大小
- ✅ base64转换过程
- ✅ 最终生成的HTML参数

这些日志帮助我们追踪整个导出流程，快速定位问题。
