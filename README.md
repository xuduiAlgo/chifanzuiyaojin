# TTS 文本转语音（中文 / English）

这是一个最小可用的 TTS（Text-to-Speech）示例，主要面向中文与英文朗读，基于浏览器自带的 Web Speech API（SpeechSynthesis）。
后端服务已迁移至 Python 实现。

## 功能

- 输入任意文本（中文/英文/混合）
- 语言选择：自动识别 / zh-CN / en-US
- 音色选择：按语言优先排序
- 语速、音调、音量调节
- 播放 / 暂停 / 继续 / 停止
- 生成音频（wav）并下载（本地服务，默认使用 Edge-TTS）
- 上传 PDF / Word (.docx) / TXT 并提取文字作为输入文本

## 使用方式

1. 安装依赖（需要 Python 3）：

   ```bash
   pip install -r requirements.txt
   ```

2. 启动本地服务：

   ```bash
   python3 server.py
   ```

3. 打开 `http://127.0.0.1:5173/`。
4. 若遇到音色列表不显示，刷新页面或等待 1–2 秒，音色加载完成后会自动更新。

## 说明与限制

- 音色由系统与浏览器提供，不同设备差异很大。
- 页面上的“播放”使用 Web Speech API；“生成音频并下载”使用本地服务生成 wav。
- 本地生成默认使用 **Edge-TTS**（高质量、多语言、跨平台支持），无需 macOS 也能运行。
- 文本输入长度上限为 50 万字符；当文本过长时会自动分段生成，并以 tar 打包下载。
- “文件导入”支持 PDF、Word (.docx) 和 TXT。Word 导入需要后端服务支持（已包含在 server.py 中）。
- “PDF 导入”优先走本地服务的 `pdftotext` 提取；若未安装会尝试加载 PDF.js（需要联网）。
- 如果是扫描件 PDF（图片），提取不到文字属于正常现象，需要 OCR。
- 默认输出格式为 **wav**（Edge-TTS 生成 mp3 后自动转码，需安装 `ffmpeg`，若无则保留 mp3 内容但后缀为 wav）。
