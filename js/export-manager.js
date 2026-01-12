/**
 * 导出管理器模块
 * 支持导出多种格式的字幕和文档
 */

const ExportManager = {
    /**
     * 导出 SRT 字幕格式
     */
    exportSRT(subtitles, filename = 'subtitles.srt') {
        const srtContent = subtitles.map((sub, index) => {
            const startTime = this.formatSRTTime(sub.start);
            const endTime = this.formatSRTTime(sub.end);
            return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}\n`;
        }).join('\n');

        this.downloadFile(srtContent, filename, 'text/plain');
    },

    /**
     * 格式化 SRT 时间戳 (HH:MM:SS,mmm)
     */
    formatSRTTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    },

    /**
     * 导出 VTT 字幕格式
     */
    exportVTT(subtitles, filename = 'subtitles.vtt') {
        let vttContent = 'WEBVTT\n\n';

        vttContent += subtitles.map(sub => {
            const startTime = this.formatVTTTime(sub.start);
            const endTime = this.formatVTTTime(sub.end);
            return `${startTime} --> ${endTime}\n${sub.text}\n`;
        }).join('\n');

        this.downloadFile(vttContent, filename, 'text/vtt');
    },

    /**
     * 格式化 VTT 时间戳 (HH:MM:SS.mmm)
     */
    formatVTTTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    },

    /**
     * 导出 ASS 字幕格式
     */
    exportASS(subtitles, filename = 'subtitles.ass') {
        const header = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        const events = subtitles.map(sub => {
            const startTime = this.formatASSTime(sub.start);
            const endTime = this.formatASSTime(sub.end);
            // 转义 ASS 特殊字符
            const text = sub.text.replace(/[\\{}]/g, '\\$&');
            return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}`;
        }).join('\n');

        this.downloadFile(header + events, filename, 'text/plain');
    },

    /**
     * 格式化 ASS 时间戳 (H:MM:SS.mm)
     */
    formatASSTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);

        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    },

    /**
     * 导出纯文本格式
     */
    exportText(subtitles, filename = 'transcript.txt') {
        const textContent = subtitles.map(sub => sub.text).join('\n');
        this.downloadFile(textContent, filename, 'text/plain');
    },

    /**
     * 导出带时间戳的文本格式
     */
    exportTimestampedText(subtitles, filename = 'transcript_timestamped.txt') {
        const content = subtitles.map(sub => {
            const timeStr = this.formatSRTTime(sub.start);
            return `[${timeStr}] ${sub.text}`;
        }).join('\n');
        this.downloadFile(content, filename, 'text/plain');
    },

    /**
     * 导出 JSON 格式
     */
    exportJSON(subtitles, filename = 'subtitles.json') {
        const jsonContent = JSON.stringify(subtitles, null, 2);
        this.downloadFile(jsonContent, filename, 'application/json');
    },

    /**
     * 导出 CSV 格式
     */
    exportCSV(subtitles, filename = 'subtitles.csv') {
        const header = '序号,开始时间,结束时间,文本\n';
        const rows = subtitles.map((sub, index) => {
            const start = this.formatSRTTime(sub.start);
            const end = this.formatSRTTime(sub.end);
            const text = sub.text.replace(/"/g, '""'); // 转义引号
            return `${index + 1},"${start}","${end}","${text}"`;
        }).join('\n');
        
        this.downloadFile(header + rows, filename, 'text/csv');
    },

    /**
     * 导出 DOCX 格式（需要后端支持）
     */
    async exportDOCX(subtitles, filename = 'subtitles.docx', options = {}) {
        try {
            const response = await fetch('/api/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subtitles,
                    options: {
                        ...options,
                        format: 'srt'
                    }
                })
            });

            if (!response.ok) {
                throw new Error('导出失败');
            }

            const data = await response.json();
            if (data.ok && data.download_url) {
                this.downloadFromURL(data.download_url, filename);
            } else {
                throw new Error(data.error || '导出失败');
            }
        } catch (error) {
            console.error('导出 DOCX 失败:', error);
            throw error;
        }
    },

    /**
     * 导出 PDF 格式（需要后端支持）
     */
    async exportPDF(subtitles, filename = 'subtitles.pdf', options = {}) {
        try {
            const response = await fetch('/api/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subtitles,
                    options
                })
            });

            if (!response.ok) {
                throw new Error('导出失败');
            }

            const data = await response.json();
            if (data.ok && data.download_url) {
                this.downloadFromURL(data.download_url, filename);
            } else {
                throw new Error(data.error || '导出失败');
            }
        } catch (error) {
            console.error('导出 PDF 失败:', error);
            throw error;
        }
    },

    /**
     * 下载文件
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        this.downloadFromURL(url, filename);
        URL.revokeObjectURL(url);
    },

    /**
     * 从 URL 下载文件
     */
    downloadFromURL(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * 批量导出多种格式
     */
    async exportMultiple(subtitles, formats, baseFilename = 'subtitles') {
        const promises = formats.map(format => {
            const filename = `${baseFilename}.${format}`;
            
            switch (format.toLowerCase()) {
                case 'srt':
                    return Promise.resolve(this.exportSRT(subtitles, filename));
                case 'vtt':
                    return Promise.resolve(this.exportVTT(subtitles, filename));
                case 'ass':
                    return Promise.resolve(this.exportASS(subtitles, filename));
                case 'txt':
                    return Promise.resolve(this.exportText(subtitles, filename));
                case 'json':
                    return Promise.resolve(this.exportJSON(subtitles, filename));
                case 'csv':
                    return Promise.resolve(this.exportCSV(subtitles, filename));
                case 'docx':
                    return this.exportDOCX(subtitles, filename);
                case 'pdf':
                    return this.exportPDF(subtitles, filename);
                default:
                    console.warn(`不支持的格式: ${format}`);
                    return Promise.resolve();
            }
        });

        return Promise.all(promises);
    },

    /**
     * 创建导出菜单 UI
     */
    createExportMenu(subtitles, container, baseFilename = 'subtitles') {
        const menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 16px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-top: 16px;
        `;

        const formats = [
            { label: 'SRT', value: 'srt' },
            { label: 'VTT', value: 'vtt' },
            { label: 'ASS', value: 'ass' },
            { label: 'TXT', value: 'txt' },
            { label: 'JSON', value: 'json' },
            { label: 'CSV', value: 'csv' },
            { label: 'DOCX', value: 'docx' },
            { label: 'PDF', value: 'pdf' }
        ];

        formats.forEach(format => {
            const button = document.createElement('button');
            button.textContent = `导出 ${format.label}`;
            button.className = 'export-button';
            button.style.cssText = `
                padding: 8px 16px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
                transition: background 0.2s;
            `;

            button.addEventListener('mouseenter', () => {
                button.style.background = '#0056b3';
            });

            button.addEventListener('mouseleave', () => {
                button.style.background = '#007bff';
            });

            button.addEventListener('click', () => {
                const filename = `${baseFilename}.${format.value}`;
                this.export(subtitles, format.value, filename);
            });

            menu.appendChild(button);
        });

        // 添加批量导出按钮
        const batchButton = document.createElement('button');
        batchButton.textContent = '批量导出全部格式';
        batchButton.className = 'batch-export-button';
        batchButton.style.cssText = `
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background 0.2s;
        `;

        batchButton.addEventListener('mouseenter', () => {
            batchButton.style.background = '#218838';
        });

        batchButton.addEventListener('mouseleave', () => {
            batchButton.style.background = '#28a745';
        });

        batchButton.addEventListener('click', async () => {
            batchButton.disabled = true;
            batchButton.textContent = '导出中...';
            
            try {
                await this.exportMultiple(subtitles, ['srt', 'vtt', 'txt', 'json'], baseFilename);
                alert('批量导出完成！');
            } catch (error) {
                alert('导出失败: ' + error.message);
            } finally {
                batchButton.disabled = false;
                batchButton.textContent = '批量导出全部格式';
            }
        });

        menu.appendChild(batchButton);
        container.appendChild(menu);

        return menu;
    },

    /**
     * 通用导出方法
     */
    export(subtitles, format, filename = null) {
        if (!filename) {
            filename = `subtitles.${format}`;
        }

        switch (format.toLowerCase()) {
            case 'srt':
                return this.exportSRT(subtitles, filename);
            case 'vtt':
                return this.exportVTT(subtitles, filename);
            case 'ass':
                return this.exportASS(subtitles, filename);
            case 'txt':
                return this.exportText(subtitles, filename);
            case 'json':
                return this.exportJSON(subtitles, filename);
            case 'csv':
                return this.exportCSV(subtitles, filename);
            case 'docx':
                return this.exportDOCX(subtitles, filename);
            case 'pdf':
                return this.exportPDF(subtitles, filename);
            default:
                console.warn(`不支持的格式: ${format}`);
        }
    }
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.ExportManager = ExportManager;
}
