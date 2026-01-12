# API 文档

## 概述

本文档描述了 chifanzuiyaojin 项目的所有 API 接口。

## 基础信息

- **Base URL**: `http://localhost:5173`
- **数据格式**: JSON
- **字符编码**: UTF-8

## API 端点

### 1. 健康检查

检查服务是否正常运行。

**请求**
```http
GET /health
```

**响应**
```json
{
  "status": "ok",
  "timestamp": "2026-01-12T09:30:00Z"
}
```

---

### 2. 获取配置

获取服务器配置信息。

**请求**
```http
GET /api/get-config
```

**响应**
```json
{
  "ok": true,
  "dashscopeKey": "sk-***"
}
```

---

### 3. 获取可用语音列表

获取所有可用的 TTS 语音。

**请求**
```http
GET /api/voices
```

**响应**
```json
{
  "ok": true,
  "voices": [
    {
      "name": "cosyvoice-v1",
      "description": "通用女声"
    },
    {
      "name": "cosyvoice-instruct",
      "description": "指令语音"
    }
  ]
}
```

---

### 4. 文本转语音 (TTS)

将文本转换为音频文件。

**请求**
```http
POST /api/tts
Content-Type: application/json

{
  "text": "这是一段测试文本",
  "voice": "cosyvoice-v1",
  "filename": "tts-20260112-093000.wav",
  "dashscopeKey": "sk-***"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要转换的文本内容 |
| voice | string | 是 | 语音类型 |
| filename | string | 是 | 输出文件名 |
| dashscopeKey | string | 是 | Alibaba DashScope API Key |

**响应**
```json
{
  "ok": true,
  "audio_url": "/tts_output/tts-xxx.wav",
  "download_filename": "tts-20260112-093000.wav",
  "subtitles": [
    {
      "text": "这是一段",
      "start": 0.0,
      "end": 1.2
    }
  ]
}
```

**错误响应**
```json
{
  "ok": false,
  "error": "错误信息"
}
```

---

### 5. 文本分析

分析文本的关键词、摘要和主题。

**请求**
```http
POST /api/analyze-text
Content-Type: application/json

{
  "text": "这是一段需要分析的文本",
  "dashscopeKey": "sk-***"
}
```

**响应**
```json
{
  "ok": true,
  "data": {
    "keywords": ["关键词1", "关键词2"],
    "summary": "文本摘要",
    "topics": [
      {
        "title": "主题标题",
        "start_snippet": "开头片段",
        "end_snippet": "结尾片段"
      }
    ]
  }
}
```

---

### 6. 修复标点符号

使用 AI 智能修复文本的标点符号。

**请求**
```http
POST /api/fix-punctuation
Content-Type: application/json

{
  "text": "这是一段没有标点的文本",
  "dashscopeKey": "sk-***"
}
```

**响应**
```json
{
  "ok": true,
  "text": "这是一段没有标点的文本。"
}
```

---

### 7. 语音识别 (ASR)

将音频文件转换为文本。

**请求**
```http
POST /api/asr
Content-Type: multipart/form-data

file: [音频文件]
dashscopeKey: sk-***
```

**响应**
```json
{
  "ok": true,
  "transcript": "识别出的文本内容",
  "subtitles": [
    {
      "text": "第一段",
      "start": 0.0,
      "end": 2.5
    }
  ],
  "keywords": ["关键词1", "关键词2"],
  "summary": "摘要",
  "topics": []
}
```

---

### 8. OCR 文字识别

从图片中提取文字。

**请求**
```http
POST /api/ocr-to-word
Content-Type: multipart/form-data

file: [图片文件1]
file: [图片文件2]
...
dashscopeKey: sk-***
```

**参数说明**

- 支持上传多个图片文件
- 单个文件大小限制：4MB
- 最多支持 10 个文件

**响应**
```json
{
  "ok": true,
  "text": "识别出的文字内容"
}
```

---

### 9. 生成 Word 文档

将文本转换为 Word 文档。

**请求**
```http
POST /api/generate-word
Content-Type: application/json

{
  "text": "要转换为 Word 的文本内容"
}
```

**响应**
```json
{
  "ok": true,
  "download_url": "/tts_output/word-xxx.docx",
  "filename": "output.docx"
}
```

---

### 10. AI 作文建议

获取作文润色建议。

**请求**
```http
POST /api/ai-advice
Content-Type: application/json

{
  "text": "作文内容",
  "dashscopeKey": "sk-***",
  "custom_prompt": "自定义提示词（可选）"
}
```

**响应**
```json
{
  "ok": true,
  "data": {
    "score_prediction": "85分",
    "analysis": "总体评价",
    "structure_advice": "结构建议",
    "alternative_ideas": [
      {
        "title": "思路1",
        "desc": "详细描述"
      }
    ],
    "suggestions": [
      {
        "technique": "修辞手法",
        "original": "原文",
        "suggestion": "建议",
        "refined_text": "修改后的文本"
      }
    ],
    "style_demonstrations": [
      {
        "style_name": "中考风格",
        "examples": []
      }
    ]
  }
}
```

---

### 11. 生成建议 Word 文档

将 AI 建议导出为 Word 文档。

**请求**
```http
POST /api/generate-advice-word
Content-Type: application/json

{
  "original_text": "原始作文",
  "advice_data": {
    "score_prediction": "85分",
    "analysis": "评价",
    ...
  }
}
```

**响应**
```json
{
  "ok": true,
  "download_url": "/tts_output/advice-xxx.docx",
  "filename": "advice.docx"
}
```

---

### 12. 提取 PDF 文本

从 PDF 文件中提取文本。

**请求**
```http
POST /api/extract-text
Content-Type: multipart/form-data

file: [PDF 文件]
```

**响应**
```json
{
  "ok": true,
  "text": "提取的文本内容"
}
```

---

### 13. 提取 URL 内容

从网页 URL 提取文本内容。

**请求**
```http
POST /api/extract-url
Content-Type: application/json

{
  "url": "https://example.com",
  "dashscopeKey": "sk-***"
}
```

**响应**
```json
{
  "ok": true,
  "text": "提取的网页内容"
}
```

---

### 14. 导出 DOCX（新增）

将字幕导出为 DOCX 文档。

**请求**
```http
POST /api/export-docx
Content-Type: application/json

{
  "subtitles": [
    {
      "text": "字幕文本",
      "start": 0.0,
      "end": 2.0
    }
  ],
  "options": {
    "format": "srt"
  }
}
```

**响应**
```json
{
  "ok": true,
  "download_url": "/tts_output/export-xxx.docx",
  "filename": "export.docx"
}
```

---

### 15. 导出 PDF（新增）

将字幕导出为 PDF 文档。

**请求**
```http
POST /api/export-pdf
Content-Type: application/json

{
  "subtitles": [
    {
      "text": "字幕文本",
      "start": 0.0,
      "end": 2.0
    }
  ],
  "options": {}
}
```

**响应**
```json
{
  "ok": true,
  "download_url": "/tts_output/export-xxx.pdf",
  "filename": "export.pdf"
}
```

---

## 错误处理

所有 API 端点在出错时返回以下格式：

```json
{
  "ok": false,
  "error": "错误描述信息"
}
```

### 常见错误码

| 错误信息 | 说明 |
|---------|------|
| 请先配置 Alibaba DashScope Key | 缺少 API Key |
| 文件大小超过限制 | 文件过大 |
| 文件格式不支持 | 不支持的文件类型 |
| 网络连接失败 | 网络问题 |
| API 请求失败 | 外部 API 错误 |

---

## 速率限制

- 建议：每分钟不超过 60 次请求
- 文件上传：建议间隔至少 5 秒

---

## 安全建议

1. **保护 API Key**: 不要在前端暴露完整的 API Key
2. **使用 HTTPS**: 生产环境必须使用 HTTPS
3. **验证输入**: 对所有用户输入进行验证和清理
4. **限制文件大小**: 在服务器端验证文件大小
5. **添加认证**: 考虑添加 API 认证机制

---

## 注意事项

1. 所有时间戳均为秒为单位
2. 文件上传建议使用分片上传大文件
3. 长时间操作建议使用异步处理
4. 定期清理 `tts_output` 目录下的临时文件

---

## 更新日志

- **2026-01-12**: 添加导出 DOCX 和 PDF 端点
- **2026-01-12**: 优化错误处理和响应格式
