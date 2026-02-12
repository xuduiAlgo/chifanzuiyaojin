# 文件命名规范测试文档

## 更新内容

### 1. HTML离线文件命名规范

**规则：**
- 默认命名必须以输入的文件名为开头
- 如果是网址，则截取网址中有真实含义的部分为文件名
- 最终格式：`{文件名}-offline-{类型}.html`

**示例：**

| 输入文件名/URL | 生成的HTML文件名 |
|-----------------|-----------------|
| `我的演讲稿` | `我的演讲稿-offline-tts.html` |
| `会议记录.mp3` | `会议记录-offline-asr.html` |
| `https://b23.tv/BV17w411W7wQ` | `video-offline-asr.html` |
| `https://example.com/tutorials/ai-course` | `ai-course-offline-asr.html` |

### 2. 音视频文件保存命名规范

**规则：**
- 必须保存为输入文件名开头的命名方式
- 最终格式：`{文件名}-asr-{UUID}.{扩展名}` 或 `{文件名}-tts-{UUID}.{扩展名}`

**示例：**

| 输入文件名/URL | 生成的音视频文件名 |
|-----------------|-------------------|
| `会议记录.mp3` | `会议记录-asr-a1b2c3d4.mp3` |
| `演讲.wav` | `演讲-asr-e5f6g7h8.mp3` |
| `https://b23.tv/BV17w411W7wQ` | `video-asr-i9j0k1l2.mp4` |
| `https://example.com/tutorials/ai-course` | `ai-course-asr-m3n4o5p6.mp4` |

## 实现细节

### 前端实现 (js/offline-exporter.js)

新增方法：
1. `generateFilename(record, type)` - 生成文件名
2. `extractMeaningfulNameFromUrl(url)` - 从URL提取有意义的名称
3. `sanitizeFilename(name)` - 清理文件名中的非法字符

### 后端实现 (server.py)

新增函数：
1. `extract_meaningful_name_from_url(url)` - 从URL提取有意义的名称
2. `sanitize_filename(name)` - 清理文件名中的非法字符
3. `generate_filename(base_name, file_type, prefix='asr')` - 生成文件名

修改位置：
- `/api/asr` - 文件上传接口
- `/api/asr-url` - URL下载接口

## URL名称提取逻辑

对于URL输入，按以下优先级提取文件名：

1. **路径最后一部分**：`https://example.com/path/to/video` → `video`
2. **倒数第二部分**（如果最后一部分为空或太短）：`https://example.com/path/` → `path`
3. **域名**（如果没有有意义的路径）：`https://example.com` → `example.com`
4. **清理规则**：
   - 移除协议（http://, https://）
   - 移除www前缀
   - 移除查询参数和片段
   - 移除常见视频网站ID（如B站BV号）
   - 移除文件扩展名
   - 截取前50个字符（防止过长）

## 文件名清理规则

1. **非法字符替换**：将Windows文件系统不允许的字符替换为连字符
   - 禁用字符：`< > : " / \ | ? *` 及控制字符

2. **连续字符处理**：将连续的连字符和空格替换为单个连字符

3. **首尾清理**：去除首尾的连字符和空格

4. **长度限制**：基础名称最多50个字符

## 测试用例

### 测试用例1：普通文件名
- 输入：`我的演讲稿.docx`
- 预期HTML：`我的演讲稿-offline-tts.html`
- 预期音频：`我的演讲稿-tts-abc123de.wav`

### 测试用例2：带扩展名的文件
- 输入：`会议记录.mp3`
- 预期HTML：`会议记录-offline-asr.html`
- 预期音频：`会议记录-asr-fgh456ij.mp3`

### 测试用例3：B站视频URL
- 输入：`https://b23.tv/BV17w411W7wQ`
- 预期HTML：`video-offline-asr.html`
- 预期音频：`video-asr-klm789no.mp4`

### 测试用例4：长路径URL
- 输入：`https://example.com/tutorials/artificial-intelligence/introduction-to-ml`
- 预期HTML：`introduction-to-ml-offline-asr.html`
- 预期音频：`introduction-to-ml-asr-pqr012st.mp3`

### 测试用例5：包含非法字符的文件名
- 输入：`演讲:2024/01/15|重要会议.mp3`
- 预期HTML：`演讲-2024-01-15-重要会议-offline-asr.html`
- 预期音频：`演讲-2024-01-15-重要会议-asr-uvw345xy.mp3`

## 注意事项

1. **唯一性保证**：在基础文件名后添加UUID前8位，确保文件名唯一
2. **向后兼容**：保留原有的UUID作为后缀，不影响现有功能
3. **中文支持**：完全支持中文文件名
4. **浏览器兼容**：生成的HTML文件名与浏览器下载兼容

## 更新日志

- 2026-01-19: 实现文件命名规范
  - HTML离线文件：以输入文件名开头
  - 音视频文件：以输入文件名开头
  - URL支持：自动提取有意义的部分作为文件名
  - 文件名清理：自动移除非法字符
