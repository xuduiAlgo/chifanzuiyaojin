/**
 * 离线导出器模块
 * 用于生成完全离线可用的HTML文件，包含音频/视频、字幕和交互功能
 */

const OfflineExporter = {
    /**
     * 导出TTS历史记录为离线HTML文件
     */
    async exportTTSHistory(record) {
        // 创建一个工作副本，避免修改原始记录对象
        const workingRecord = { ...record };
        let finalAudioUrl = record.audioUrl;
        
        // 将音频转换为base64
        if (finalAudioUrl) {
            try {
                finalAudioUrl = await this.convertToBase64(finalAudioUrl);
            } catch (e) {
                console.warn('Failed to convert audio to base64:', e);
            }
        }
        
        // 生成HTML，传递完整的参数而不是修改record
        return this.generateOfflineHTML({
            ...workingRecord,
            audioUrl: finalAudioUrl
        }, 'tts');
    },

    /**
     * 导出ASR历史记录为离线HTML文件
     * @param {Object} record - 历史记录对象
     * @param {string} exportMode - 导出模式: 'audio' 或 'video'
     */
    async exportASRHistory(record, exportMode = 'audio') {
        console.log('=== exportASRHistory START ===');
        console.log('Export mode:', exportMode);
        console.log('File type:', record.fileType);
        console.log('Original audio URL:', record.audioUrl);
        
        // 创建一个工作副本，避免修改原始记录对象
        const workingRecord = { ...record };
        const originalAudioUrl = record.audioUrl;
        let finalAudioUrl = originalAudioUrl;
        
        // 如果是视频文件且用户选择仅音频，需要先提取音频
        if (record.fileType === 'video' && exportMode === 'audio' && originalAudioUrl) {
            console.log('>>> Audio extraction needed');
            try {
                // 检查URL是否有效（必须是包含/tts_output/的相对路径，不能是base64）
                if (originalAudioUrl.startsWith('data:')) {
                    console.warn('原始URL已是base64格式，跳过音频提取');
                    // 直接使用原始的base64数据，不进行音频提取
                    finalAudioUrl = await this.convertToBase64(originalAudioUrl);
                } else if (originalAudioUrl.includes('/tts_output/') || originalAudioUrl.startsWith('http')) {
                    console.log('>>> Calling audio extraction API...');
                    console.log('>>> Original video URL:', originalAudioUrl);
                    
                    const res = await fetch('/api/extract-audio', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ video_url: originalAudioUrl })
                    });
                    
                    const data = await res.json();
                    console.log('>>> API response:', data);
                    
                    if (data.ok) {
                        console.log('>>> Audio extracted successfully!');
                        console.log('>>> Extracted audio URL:', data.audio_url);
                        console.log('>>> Audio file size:', data.audio_size, 'Video file size:', data.video_size);
                        
                        // 验证提取的音频URL确实不同
                        if (data.audio_url === originalAudioUrl) {
                            console.error('ERROR: Extracted audio URL is same as video URL!');
                            alert('音频提取失败：返回的URL与原始URL相同');
                            return;
                        }
                        
                        // 使用提取后的音频URL
                        finalAudioUrl = data.audio_url;
                        console.log('>>> Final audio URL after extraction:', finalAudioUrl);
                    } else {
                        console.error('Failed to extract audio:', data.error);
                        alert('音频提取失败: ' + (data.error || '未知错误'));
                        return;
                    }
                } else {
                    throw new Error('音频URL格式不正确，无法提取音频。请重新上传文件进行转写。');
                }
            } catch (e) {
                console.error('Error extracting audio:', e);
                alert('音频提取出错: ' + e.message);
                return;
            }
        } else {
            console.log('>>> Audio extraction NOT needed (either not video or exportMode is video)');
        }
        
        // 将媒体文件转换为base64
        if (finalAudioUrl && !finalAudioUrl.startsWith('data:')) {
            try {
                console.log('>>> Converting to base64...');
                console.log('>>> Converting URL:', finalAudioUrl);
                finalAudioUrl = await this.convertToBase64(finalAudioUrl);
                console.log('>>> Base64 conversion completed, length:', finalAudioUrl.length);
                console.log('>>> First 100 chars:', finalAudioUrl.substring(0, 100));
            } catch (e) {
                console.warn('Failed to convert media to base64:', e);
            }
        } else {
            console.log('>>> Already base64 or no URL, skipping conversion');
        }
        
        console.log('>>> Generating HTML with exportMode:', exportMode);
        
        // 生成HTML，传递完整的参数而不是修改record
        return this.generateOfflineHTML({
            ...workingRecord,
            audioUrl: finalAudioUrl,
            exportMode: exportMode,
            fileType: record.fileType
        }, 'asr');
    },

    /**
     * 将URL转换为base64编码
     */
    async convertToBase64(url) {
        return new Promise((resolve, reject) => {
            if (url.startsWith('data:')) {
                // 已经是base64格式
                resolve(url);
                return;
            }
            
            // 如果是blob URL，转换为base64
            fetch(url)
                .then(response => response.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                })
                .catch(reject);
        });
    },

    /**
     * 生成离线HTML文件
     */
    async generateOfflineHTML(record, type) {
        const title = this.getTitle(record, type);
        const htmlContent = this.generateHTML(record, type, title);
        
        // 生成文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `offline-${type}-${timestamp}.html`;
        
        // 下载文件
        this.downloadHTML(htmlContent, filename);
    },

    /**
     * 生成完整的HTML内容
     */
    generateHTML(record, type, title) {
        const styles = this.getInlineStyles();
        const subtitlesJSON = JSON.stringify(record.subtitles || []);
        const analysisJSON = JSON.stringify(this.getAnalysisData(record, type));
        
        // 获取音频/视频数据
        let mediaHTML = '';
        let mediaType = '';
        const mediaSrc = record.audioUrl || '';
        
        if (type === 'tts') {
            mediaType = 'audio';
            mediaHTML = `
                <div class="player-container">
                    <label class="label">音频播放器</label>
                    <audio id="mediaPlayer" controls src="${mediaSrc}">
                        您的浏览器不支持音频播放。
                    </audio>
                </div>
            `;
        } else {
            // ASR 类型需要检查文件类型和导出模式
            const fileType = record.fileType || 'audio';
            const exportMode = record.exportMode || 'audio';
            
            // 根据导出模式决定播放器类型
            // 如果原文件是视频，并且导出模式是video，则显示视频播放器
            // 如果原文件是音频，或者导出模式是audio，则显示音频播放器
            if (fileType === 'video' && exportMode === 'video') {
                mediaType = 'video';
                mediaHTML = `
                    <div class="player-container">
                        <label class="label">视频播放器</label>
                        <video id="mediaPlayer" controls src="${mediaSrc}" style="max-height: 400px;">
                            您的浏览器不支持视频播放。
                        </video>
                    </div>
                `;
            } else {
                // 其他情况都显示音频播放器（包括：原文件是音频，或导出模式是audio）
                mediaType = 'audio';
                mediaHTML = `
                    <div class="player-container">
                        <label class="label">音频播放器</label>
                        <audio id="mediaPlayer" controls src="${mediaSrc}">
                            您的浏览器不支持音频播放。
                        </audio>
                    </div>
                `;
            }
        }

        // 生成字幕HTML
        const subtitlesSection = this.generateSubtitlesSection(record.subtitles || []);

        // 生成分析结果HTML
        const analysisSection = this.generateAnalysisSection(record, type);

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 离线查看</title>
    <style>
${styles}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title">${title}</h1>
            <p class="subtitle">离线查看模式</p>
        </header>

        <!-- 播放器 -->
        <section class="card">
${mediaHTML}
        </section>

        <!-- 字幕区域 -->
        <section class="card">
            <div class="section-header">
                <h2 class="h2">📝 交互式字幕</h2>
                <p class="hint">点击字幕可跳转到对应位置</p>
            </div>
            <div id="highlightContainer" class="highlight-container"></div>
        </section>

        <!-- 分析结果 -->
${analysisSection}

        <!-- 原文内容 -->
        <section class="card">
            <h2 class="h2">📄 原文内容</h2>
            <div class="content-text">${this.escapeHTML(record.text || record.transcript || '无内容')}</div>
        </section>

        <footer class="footer">
            <p>由 AI 语音工作台生成 | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </footer>
    </div>

    <script>
        // 内嵌数据
        window.subtitlesData = ${subtitlesJSON};
        window.analysisData = ${analysisJSON};
        window.recordType = '${type}';

        // 初始化
        document.addEventListener('DOMContentLoaded', function() {
            const player = document.getElementById('mediaPlayer');
            const highlightContainer = document.getElementById('highlightContainer');
            
            if (!player || !highlightContainer) return;
            
            const subtitles = window.subtitlesData || [];
            
            // 渲染字幕
            if (subtitles.length > 0) {
                highlightContainer.innerHTML = subtitles.map((sub, idx) => {
                    return '<span class="word-span" data-idx="' + idx + '" data-start="' + sub.start + '" data-end="' + sub.end + '">' + sub.text + '</span>';
                }).join('');
            } else {
                highlightContainer.innerHTML = '<p style="color: var(--muted);">暂无字幕数据</p>';
            }
            
            // 时间更新 - 更新高亮
            player.addEventListener('timeupdate', function() {
                const time = player.currentTime;
                const activeIdx = subtitles.findIndex(s => time >= s.start && time <= s.end);
                
                const currentActive = highlightContainer.querySelector('.word-span.active');
                if (currentActive && currentActive.dataset.idx != activeIdx) {
                    currentActive.classList.remove('active');
                }
                
                if (activeIdx !== -1) {
                    const target = highlightContainer.querySelector('.word-span[data-idx="' + activeIdx + '"]');
                    if (target) {
                        target.classList.add('active');
                        // 平滑滚动到可见区域
                        const container = highlightContainer;
                        if (target.offsetTop > container.scrollTop + container.clientHeight - 50 || 
                            target.offsetTop < container.scrollTop) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                }
            });
            
            // 点击字幕跳转
            highlightContainer.addEventListener('click', function(e) {
                const target = e.target.closest('.word-span');
                if (!target) return;
                const start = parseFloat(target.dataset.start);
                if (!isNaN(start)) {
                    player.currentTime = start;
                    player.play();
                }
            });
            
            // 初始化主题点击跳转
            initTopicClickHandler(player);
        });
        
        // 格式化时间
        function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return m + '分' + s + '秒';
        }
        
        // 初始化主题点击跳转
        function initTopicClickHandler(player) {
            const subtitles = window.subtitlesData || [];
            const analysisData = window.analysisData || {};
            
            // 获取主题列表
            const topics = window.recordType === 'tts' 
                ? (analysisData.topics || []) 
                : (analysisData.topics || []);
            
            if (topics.length === 0) return;
            
            const topicsContainer = document.getElementById('topicsList');
            if (!topicsContainer) return;
            
            topicsContainer.innerHTML = '';
            
            topics.forEach((topic, idx) => {
                const li = document.createElement('li');
                li.className = 'topic-item';
                
                // 查找时间戳
                let startT = 0, endT = 0;
                let found = false;
                
                if (topic.start_snippet && subtitles.length > 0) {
                    const cleanSnippet = topic.start_snippet.replace(/[^\\u4e00-\\u9fa5a-zA-Z0-9]/g, "");
                    const snippetLen = Math.min(cleanSnippet.length, 15);
                    const searchStr = cleanSnippet.substring(0, snippetLen);
                    
                    let matchIdx = -1;
                    
                    // 尝试精确匹配
                    matchIdx = subtitles.findIndex(s => {
                        const cleanSub = s.text.replace(/[^\\u4e00-\\u9fa5a-zA-Z0-9]/g, "");
                        return cleanSub.includes(searchStr);
                    });
                    
                    // 模糊匹配
                    if (matchIdx === -1) {
                        for (let i = 0; i < subtitles.length; i++) {
                            let combined = subtitles[i].text;
                            if (i + 1 < subtitles.length) combined += subtitles[i + 1].text;
                            if (i + 2 < subtitles.length) combined += subtitles[i + 2].text;
                            
                            const cleanCombined = combined.replace(/[^\\u4e00-\\u9fa5a-zA-Z0-9]/g, "");
                            
                            if (cleanCombined.includes(searchStr)) {
                                matchIdx = i;
                                break;
                            }
                        }
                    }
                    
                    if (matchIdx !== -1) {
                        startT = subtitles[matchIdx].start;
                        found = true;
                        
                        if (topic.end_snippet) {
                            const cleanEnd = topic.end_snippet.replace(/[^\\u4e00-\\u9fa5a-zA-Z0-9]/g, "").substring(0, 10);
                            let endMatchIdx = subtitles.findIndex((s, idx) => idx > matchIdx && s.text.replace(/[^\\u4e00-\\u9fa5a-zA-Z0-9]/g, "").includes(cleanEnd));
                            
                            if (endMatchIdx === -1) {
                                for (let i = matchIdx + 1; i < subtitles.length; i++) {
                                    let combined = subtitles[i].text;
                                    if (i + 1 < subtitles.length) combined += subtitles[i + 1].text;
                                    if (i + 2 < subtitles.length) combined += subtitles[i + 2].text;
                                    
                                    const cleanCombined = combined.replace(/[^\\u4e00-\\u9fa5a-zA-Z0-9]/g, "");
                                    if (cleanCombined.includes(cleanEnd)) {
                                        endMatchIdx = i;
                                        break;
                                    }
                                }
                            }
                            
                            if (endMatchIdx !== -1) {
                                endT = subtitles[endMatchIdx].end;
                            }
                        }
                    }
                }
                
                // 渲染
                let timeInfo = '';
                if (found) {
                    const timeStr = endT > startT ? formatTime(startT) + '~' + formatTime(endT) : formatTime(startT);
                    timeInfo = '<span style="color:var(--primary); font-size:0.85em; margin-left:8px;">[' + timeStr + ']</span>';
                    
                    li.style.cursor = 'pointer';
                    li.title = '点击跳转到 ' + formatTime(startT);
                    li.addEventListener('click', function() {
                        player.currentTime = startT;
                        player.play();
                    });
                } else {
                    timeInfo = '<span style="color:var(--muted); font-size:0.85em; margin-left:8px;">[未匹配]</span>';
                }
                
                li.innerHTML = '<span>' + topic.title + '</span>' + timeInfo;
                li.style.margin = '8px 0';
                li.style.color = 'var(--text)';
                li.style.fontSize = '14px';
                li.style.lineHeight = '1.7';
                
                topicsContainer.appendChild(li);
            });
        }
    </script>
</body>
</html>`;
    },

    /**
     * 获取内联CSS样式
     */
    getInlineStyles() {
        return `/* 基础样式 */
:root {
    --primary: #5b8cff;
    --primary-dark: #4a7ae0;
    --text: #333333;
    --text-muted: #666666;
    --bg: #ffffff;
    --bg-muted: #f5f5f5;
    --border: #e0e0e0;
    --danger: #dc3545;
    --success: #28a745;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
    color: var(--text);
    line-height: 1.6;
}

.container {
    max-width: 1000px;
    margin: 0 auto;
}

/* 头部 */
.header {
    text-align: center;
    margin-bottom: 30px;
    color: white;
}

.title {
    font-size: 2.5em;
    font-weight: bold;
    margin-bottom: 8px;
}

.subtitle {
    font-size: 1.1em;
    opacity: 0.9;
}

/* 卡片 */
.card {
    background: var(--bg);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.h2 {
    font-size: 1.5em;
    font-weight: 600;
    margin-bottom: 12px;
}

.h3 {
    font-size: 1.2em;
    font-weight: 500;
    margin-bottom: 8px;
}

/* 标签和提示 */
.label {
    display: block;
    font-weight: 500;
    margin-bottom: 8px;
    color: var(--text);
}

.hint {
    font-size: 0.85em;
    color: var(--text-muted);
    margin-top: 4px;
}

/* 播放器容器 */
.player-container {
    margin-bottom: 16px;
}

.player-container audio,
.player-container video {
    width: 100%;
    max-width: 100%;
    border-radius: 8px;
}

/* 高亮字幕容器 */
.highlight-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    padding: 16px;
    background: var(--bg-muted);
    border-radius: 8px;
    max-height: 300px;
    overflow-y: auto;
    line-height: 1.6;
    font-size: 1em;
}

.word-span {
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    margin-right: 0;
    display: inline-block;
}

.word-span:hover {
    background: rgba(91, 140, 255, 0.1);
    border-color: var(--primary);
}

.word-span.active {
    background: rgba(91, 140, 255, 0.25);
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 500;
    padding: 2px 6px;
}

/* 分析结果 */
.analysis-section {
    margin-top: 20px;
}

.analysis-item {
    margin-bottom: 16px;
}

/* 关键词标签 */
.keyword-tag {
    display: inline-block;
    padding: 6px 12px;
    background: var(--bg-muted);
    border-radius: 16px;
    font-size: 0.9em;
    margin-right: 8px;
    margin-bottom: 8px;
    border: 1px solid var(--border);
}

.keyword-tag:hover {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

/* 主题列表 */
.topic-list {
    list-style: none;
    padding: 0;
}

.topic-item {
    padding: 12px;
    background: var(--bg-muted);
    border-radius: 6px;
    margin-bottom: 8px;
    transition: background 0.2s;
}

.topic-item:hover {
    background: rgba(91, 140, 255, 0.1);
}

/* 内容文本 */
.content-text {
    padding: 16px;
    background: var(--bg-muted);
    border-radius: 8px;
    max-height: 400px;
    overflow-y: auto;
    line-height: 1.8;
    white-space: pre-wrap;
}

/* 分隔线 */
.divider {
    height: 1px;
    background: var(--border);
    margin: 24px 0;
}

/* 列表 */
.list {
    list-style: none;
    padding-left: 0;
}

/* 页脚 */
.footer {
    text-align: center;
    margin-top: 40px;
    padding: 20px;
    color: white;
    opacity: 0.8;
}

/* 响应式 */
@media (max-width: 768px) {
    body {
        padding: 10px;
    }
    
    .title {
        font-size: 2em;
    }
    
    .card {
        padding: 16px;
    }
    
    .highlight-container {
        font-size: 1em;
    }
}`;
    },

    /**
     * 生成字幕区域HTML
     */
    generateSubtitlesSection(subtitles) {
        if (!subtitles || subtitles.length === 0) {
            return `<div class="hint">暂无字幕数据</div>`;
        }
        return `<div id="highlightContainer" class="highlight-container">
            <!-- 字幕将通过JavaScript动态渲染 -->
        </div>`;
    },

    /**
     * 生成分析结果区域HTML
     */
    generateAnalysisSection(record, type) {
        const analysis = this.getAnalysisData(record, type);
        
        if (!analysis || Object.keys(analysis).length === 0) {
            return '';
        }

        let html = '<section class="card"><h2 class="h2">🔍 AI 分析结果</h2>';
        
        // 关键词
        if (analysis.keywords && analysis.keywords.length > 0) {
            html += `
                <div class="analysis-item">
                    <div class="label">关键词</div>
                    <div style="margin-top: 8px;">
                        ${analysis.keywords.map(kw => `<span class="keyword-tag">${this.escapeHTML(kw)}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        // 摘要
        if (analysis.summary) {
            html += `
                <div class="analysis-item">
                    <div class="label">全文摘要</div>
                    <div style="margin-top: 8px; color: var(--text); line-height: 1.6;">
                        ${this.escapeHTML(analysis.summary)}
                    </div>
                </div>
            `;
        }
        
        // 主题分段
        if (analysis.topics && analysis.topics.length > 0) {
            html += `
                <div class="analysis-item">
                    <div class="label">主题分段（点击跳转）</div>
                    <ul id="topicsList" class="topic-list" style="margin-top: 12px; padding-left: 0;">
                        <!-- 主题将通过JavaScript动态渲染 -->
                    </ul>
                </div>
            `;
        }
        
        html += '</section>';
        return html;
    },

    /**
     * 获取分析数据
     */
    getAnalysisData(record, type) {
        if (type === 'tts') {
            return record.analysis || {};
        } else if (type === 'asr') {
            return {
                keywords: record.keywords || [],
                summary: record.summary || '',
                topics: record.topics || []
            };
        }
        return {};
    },

    /**
     * 获取标题
     */
    getTitle(record, type) {
        const typeLabel = type === 'tts' ? 'TTS 语音合成' : 'ASR 语音识别';
        const filename = record.filename || '未命名';
        return `${typeLabel} - ${filename}`;
    },

    /**
     * HTML转义
     */
    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 下载HTML文件
     */
    downloadHTML(htmlContent, filename) {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.OfflineExporter = OfflineExporter;
}
