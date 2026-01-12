# chifanzuiyaojin - 智能内容处理平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9+-green.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](https://www.docker.com/)

一个功能强大的多媒体内容处理平台，集成了文本转语音、语音识别、OCR 文字识别、AI 作文润色等智能功能。

## ✨ 主要功能

### 🎤 文本转语音 (TTS)
- 支持中英文混合文本朗读
- 多种语音类型选择（通用语音、指令语音等）
- 实时音频预览和下载
- 支持 WAV 格式输出
- 自动生成同步字幕

### 🎧 语音识别 (ASR)
- 支持音频/视频文件转写
- 自动生成交互式字幕
- 关键词提取和文本摘要
- 主题识别和智能分段
- 支持导出为 Word 文档和多种字幕格式

### 📄 OCR 文字识别
- 支持批量图片识别（最多 10 张）
- 自动识别手写和印刷文字
- 支持 JPG、PNG、GIF、BMP 格式
- 识别结果可编辑和导出
- 特别优化中学生手写作文识别

### 📝 AI 作文润色
- **模拟中考阅卷专家**：资深上海中考语文阅卷组长角色
- **评分预测**：根据中考标准给出预估分数（满分 60 分）
- **结构建议**：从"记事"提升到"感悟"的进阶思路
- **细节润色**：明确指出高级写作手法和升格示例
- **风格示范**：提供多种风格的润色示范
- **Word 导出**：完整导出评分、建议和示例

### 📊 文本分析
- 自动关键词提取
- 智能文本摘要生成
- 主题识别和分类
- 时间戳关联（可跳转到对应音频位置）

### 📦 文档导出
- 支持导出为 Word、PDF 文档
- 支持 SRT、VTT、ASS 等字幕格式
- 支持 TXT、JSON、CSV 等数据格式
- 批量导出功能

## 🚀 快速开始

### 使用 Docker（推荐）

```bash
# 克隆项目
git clone https://github.com/xuduiAlgo/chifanzuiyaojin.git
cd chifanzuiyaojin

# 启动生产环境
docker-compose up -d

# 启动开发环境
docker-compose --profile dev up -d
```

访问 `http://localhost:5173` 开始使用。

### 使用本地 Python

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务器
python server.py
```

访问 `http://localhost:5173` 开始使用。

### 获取 API Key

1. 访问 [Alibaba Cloud DashScope](https://dashscope.aliyun.com/)
2. 注册并登录账号
3. 创建 API Key
4. 在应用的"配置"选项卡中输入您的 API Key

## 📚 文档

- [用户指南](./docs/USER_GUIDE.md) - 详细的功能使用说明
- [API 文档](./docs/API.md) - 完整的 API 接口文档
- [性能分析](./docs/PERFORMANCE.md) - 性能优化方案和基准测试

## 🏗️ 技术架构

### 前端
- **纯 JavaScript** - 无框架依赖，轻量高效
- **模块化设计** - 代码组织清晰，易于维护
- **性能优化** - 缓存机制、懒加载、虚拟滚动
- **响应式设计** - 支持多种设备和屏幕尺寸

### 后端
- **Python 3.9+** - 稳定可靠的运行环境
- **Flask** - 轻量级 Web 框架
- **Edge-TTS** - 高质量语音合成
- **Alibaba DashScope** - 强大的 AI 能力支持

### 新增模块
- **CacheManager** - 智能缓存管理（LRU/LFU）
- **ErrorHandler** - 统一错误处理机制
- **ProgressIndicator** - 进度指示器
- **ExportManager** - 多格式导出管理器

## 🎯 核心特性

### 性能优化
- ✅ 智能缓存机制，重复请求响应时间降低 80-90%
- ✅ 异步处理，避免阻塞主线程
- ✅ 前端性能优化（虚拟滚动、懒加载、防抖节流）
- ✅ 连接池管理，提高资源利用率

### 用户体验
- ✅ 实时进度反馈
- ✅ 友好的错误提示
- ✅ 交互式字幕编辑
- ✅ 批量处理支持

### 生产就绪
- ✅ Docker 多阶段构建
- ✅ Docker Compose 编排
- ✅ 健康检查配置
- ✅ Nginx 反向代理支持

## 📋 系统要求

### 浏览器
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 服务器
- Python 3.9+
- 2GB+ RAM
- 10GB+ 可用磁盘空间

### 网络
- 需要稳定的互联网连接（访问 Alibaba Cloud API）

## 📁 项目结构

```
chifanzuiyaojin/
├── app.js                      # 前端主应用
├── server.py                   # 后端服务器
├── style.css                   # 样式文件
├── index.html                  # 主页面
├── Dockerfile                  # 开发环境 Docker 配置
├── Dockerfile.prod             # 生产环境 Docker 配置
├── docker-compose.yml          # Docker Compose 编排
├── requirements.txt            # Python 依赖
├── js/                         # JavaScript 模块
│   ├── error-handler.js       # 错误处理
│   ├── progress-indicator.js  # 进度指示器
│   ├── cache-manager.js       # 缓存管理
│   └── export-manager.js      # 导出管理
├── tests/                      # 测试文件
│   └── app.test.js            # 单元测试
├── docs/                       # 文档
│   ├── API.md                 # API 文档
│   ├── USER_GUIDE.md          # 用户指南
│   └── PERFORMANCE.md         # 性能分析
├── tts_output/                 # 输出文件目录
└── REFACTORING_PLAN.md         # 重构计划
```

## 🧪 测试

```bash
# 运行单元测试
npm test

# 或使用 Jest
npx jest tests/app.test.js
```

## 🔧 配置

### 环境变量

```bash
# 服务器端口
PORT=5173

# 日志级别
LOG_LEVEL=info

# Python 设置
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
```

### 缓存配置

```javascript
// API 缓存：5 分钟
cache.api.init({
    maxSize: 50,
    ttl: 300000,
    persistToLocalStorage: false
});

// AI 缓存：1 小时
cache.ai.init({
    maxSize: 20,
    ttl: 3600000,
    persistToLocalStorage: true
});

// TTS 缓存：24 小时
cache.tts.init({
    maxSize: 30,
    ttl: 86400000,
    persistToLocalStorage: true
});
```

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Edge-TTS](https://github.com/rany2/edge-tts) - 语音合成引擎
- [Alibaba DashScope](https://dashscope.aliyun.com/) - AI 能力支持
- 所有贡献者

## 📮 联系方式

- 项目主页: [GitHub Repository](https://github.com/xuduiAlgo/chifanzuiyaojin)
- 问题反馈: [GitHub Issues](https://github.com/xuduiAlgo/chifanzuiyaojin/issues)

---

**注意**: 本项目仅供学习和研究使用，请遵守相关 API 的使用条款和限制。
