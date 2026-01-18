/**
 * 日志解析器模块
 * 从后端日志中解析进度信息
 */

const LogParser = {
    /**
     * ASR进度映射规则
     * 根据日志内容映射到0-100%进度
     */
    ASR_PROGRESS_MAP: {
        // 初始状态
        'START': 0,
        // 开始分片
        'AUDIO_TOO_LONG': 10,
        // 分片处理中：10% + (当前分片/总分片 × 80%)
        'CHUNK_START': (current, total) => {
            return 10 + 80 * (current / total);
        },
        // 模型尝试（不分片情况）
        'MODEL_TRYING': 20,
        // 流式处理开始（不分片情况）
        'STREAM_STARTING': 40,
        // 流式处理完成（不分片情况）
        'STREAM_FINISHED': 90,
        // 最后一个分片完成
        'LAST_CHUNK_DONE': 95,
        // 完成
        'COMPLETE': 100
    },

    /**
     * 从日志行数组中解析ASR/TTS进度
     * @param {Array<string>} logs - 日志行数组
     * @param {string} type - 'ASR' 或 'TTS'
     * @param {string} taskId - 任务ID，用于过滤日志（可选）
     * @returns {Object} 解析结果
     */
    parseLogs(logs, type = 'ASR', taskId = null) {
        if (!Array.isArray(logs) || logs.length === 0) {
            return { progress: 0, status: '等待中...', event: 'NONE' };
        }
        
        let currentProgress = 0;
        let currentStatus = '等待中...';
        let currentEvent = 'NONE';
        
        // 用于追踪总分片数和当前分片
        let totalChunks = 0;
        let currentChunkNumber = 0;
        let foundLastChunk = false;
        let lastChunkFinished = false; // 最后一个chunk是否已经Stream finished
        let isChunkedMode = false;
        
        // 合并所有日志行到单个字符串以便搜索
        const allLogsText = logs.join('\n');
        
        console.log(`[LogParser] 解析${type}日志，共${logs.length}行日志${taskId ? `, 任务ID: ${taskId}` : ''}`);
        console.log(`[LogParser] 日志内容预览:`, allLogsText.substring(0, 500));
        
        // 反向遍历日志（从最新到最旧），但只保留最早匹配到的chunk
        // 这样可以找到第一个开始处理的chunk，而不是最后一个chunk
        for (let i = logs.length - 1; i >= 0; i--) {
            const line = logs[i].trim();
            if (!line) continue;
            
            // 跳过HTTP访问日志
            if (line.includes('GET /api/logs') || line.includes('HTTP/1.1')) {
                continue;
            }
            
            // 如果指定了taskId，只处理包含该taskId的日志行
            if (taskId && !line.includes(`Task ID: ${taskId}`)) {
                continue;
            }
            
            // ASR日志解析
            if (type === 'ASR') {
                // 匹配 "Audio too long (Xs), splitting..."
                const splitMatch = line.match(/Audio too long \((\d+\.?\d*)s\), splitting/);
                if (splitMatch) {
                    currentProgress = 10;
                    currentStatus = '正在分割音频...';
                    currentEvent = 'SPLITTING';
                    isChunkedMode = true;
                    console.log(`[LogParser] 匹配到SPLITTING事件: ${line}`);
                    continue;
                }
                
                // 匹配 "Processing chunk X/Y..."
                // 只记录第一个找到的chunk（从最新日志往回找的第一个chunk）
                // 这样能显示当前正在处理的chunk
                if (currentChunkNumber === 0) { // 还没有找到chunk
                    const chunkMatch = line.match(/Processing chunk (\d+)\/(\d+)/);
                    if (chunkMatch) {
                        const currentChunk = parseInt(chunkMatch[1]);
                        const thisTotalChunks = parseInt(chunkMatch[2]);
                        
                        // 只记录第一个找到的chunk
                        if (thisTotalChunks > 0) {
                            totalChunks = thisTotalChunks;
                            currentChunkNumber = currentChunk;
                            isChunkedMode = true;
                            
                            // 检查是否是最后一个chunk
                            if (currentChunk === totalChunks) {
                                foundLastChunk = true;
                            }
                            // 重置最后一个chunk的完成状态
                            lastChunkFinished = false;
                            
                            // 进度：10% + (当前分片/总分片 × 80%)
                            const chunkProgress = 10 + (currentChunk / totalChunks * 80);
                            currentProgress = Math.round(chunkProgress * 100) / 100; // 保留两位小数后取整
                            currentStatus = `正在处理分片 ${currentChunk}/${totalChunks}...`;
                            currentEvent = 'PROCESSING';
                            console.log(`[LogParser] 匹配到PROCESSING事件: ${line}, 进度: ${currentProgress}%`);
                            
                            // 找到chunk后continue，不再查找更旧的chunk
                            // 但在continue之前先检查Stream finished和POST请求
                            // 这些检查放在匹配chunk的if块之后，但在continue之前
                        }
                    }
                }
                
                // 如果已经找到chunk，只检查Stream finished和POST请求，然后continue
                if (currentChunkNumber > 0) {
                    // 检查Stream finished（仅对分片模式）
                    if (isChunkedMode) {
                        const streamFinishMatch = line.match(/DEBUG: Stream finished\. Content len:/);
                        if (streamFinishMatch && foundLastChunk) {
                            lastChunkFinished = true;
                            console.log(`[LogParser] 匹配到STREAM_FINISHED事件(分片模式): ${line}, lastChunkFinished=${lastChunkFinished}`);
                        }
                    }
                    
                    // 检查POST /api/asr 200（分片模式的完成判断）
                    if (isChunkedMode && foundLastChunk && lastChunkFinished &&
                        line.includes('POST /api/asr') && line.includes('200')) {
                        currentProgress = 100;
                        currentStatus = '完成';
                        currentEvent = 'COMPLETE';
                        console.log(`[LogParser] 匹配到COMPLETE事件(分片模式): ${line}`);
                    }
                    
                    // 找到chunk后，检查完Stream finished和POST请求后就continue
                    // 不再查找更旧的日志
                    continue;
                }
                
                // 不分片模式的进度追踪
                if (!isChunkedMode && currentChunkNumber === 0) {
                    // 匹配 "ASR Trying model: ..."
                    const modelMatch = line.match(/ASR Trying model:/);
                    if (modelMatch) {
                        currentProgress = 20;
                        currentStatus = '正在调用模型...';
                        currentEvent = 'MODEL_TRYING';
                        console.log(`[LogParser] 匹配到MODEL_TRYING事件: ${line}`);
                        continue;
                    }
                    
                    // 匹配 "DEBUG: Starting stream for ..."
                    const streamStartMatch = line.match(/DEBUG: Starting stream for/);
                    if (streamStartMatch) {
                        currentProgress = 40;
                        currentStatus = '正在接收流式数据...';
                        currentEvent = 'STREAM_STARTING';
                        console.log(`[LogParser] 匹配到STREAM_STARTING事件: ${line}`);
                        continue;
                    }
                    
                    // 匹配 "DEBUG: Stream finished. Content len: ..."（不分片模式）
                    const streamFinishMatch = line.match(/DEBUG: Stream finished\. Content len:/);
                    if (streamFinishMatch) {
                        currentProgress = 90;
                        currentStatus = '正在处理结果...';
                        currentEvent = 'STREAM_FINISHED';
                        console.log(`[LogParser] 匹配到STREAM_FINISHED事件(不分片模式): ${line}`);
                        continue;
                    }
                }
                
                // 分片模式下的Stream finished匹配（必须在if (!isChunkedMode)外面）
                // 注意：这部分代码实际上不会被执行到，因为在currentChunkNumber>0时已经continue了
                if (isChunkedMode && currentChunkNumber === 0) {
                    // 匹配 "DEBUG: Stream finished. Content len: ..."
                    const streamFinishMatch = line.match(/DEBUG: Stream finished\. Content len:/);
                    if (streamFinishMatch) {
                        // 如果是最后一个chunk的Stream finished，标记它
                        if (foundLastChunk) {
                            lastChunkFinished = true;
                        }
                        console.log(`[LogParser] 匹配到STREAM_FINISHED事件(分片模式): ${line}, foundLastChunk=${foundLastChunk}, lastChunkFinished=${lastChunkFinished}`);
                        // 注意：不更新进度，因为进度是由chunk进度控制的
                        continue;
                    }
                }
                
                // 不分片模式下的完成判断
                if (!isChunkedMode) {
                    // 严格的完成判断：必须匹配到 "ASR completed successfully"
                    if (line.includes('ASR completed successfully')) {
                        currentProgress = 100;
                        currentStatus = '完成';
                        currentEvent = 'COMPLETE';
                        console.log(`[LogParser] 匹配到COMPLETE事件: ${line}`);
                        continue;
                    }
                }
            }
            
            // TTS日志解析
            else if (type === 'TTS') {
                // 匹配 "TTS Call (Model: ..."
                const ttsCallMatch = line.match(/TTS Call \(Model:.*Attempt \d+\/\d+\): voice=/);
                if (ttsCallMatch) {
                    currentProgress = 30;
                    currentStatus = '正在生成音频...';
                    currentEvent = 'GENERATING';
                    console.log(`[LogParser] 匹配到GENERATING事件: ${line}`);
                    continue;
                }
                
                // 匹配 "Direct download complete:" 或 "yt-dlp download complete:"
                if (line.includes('Direct download complete:') || 
                    line.includes('yt-dlp download complete:')) {
                    currentProgress = 80;
                    currentStatus = '正在保存文件...';
                    currentEvent = 'SAVING';
                    console.log(`[LogParser] 匹配到SAVING事件: ${line}`);
                    continue;
                }
                
                // 匹配 "POST /api/tts HTTP/1.1" 200 或 "GET /tts_output/tts-* HTTP/1.1" 200
                if ((line.includes('POST /api/tts') && line.includes('200')) ||
                    (line.includes('GET /tts_output/tts-') && line.includes('200'))) {
                    currentProgress = 100;
                    currentStatus = '完成';
                    currentEvent = 'COMPLETE';
                    console.log(`[LogParser] 匹配到COMPLETE事件: ${line}`);
                    continue;
                }
                
                // 默认初始状态
                if (currentProgress === 0) {
                    currentProgress = 10;
                    currentStatus = '准备中...';
                    currentEvent = 'PREPARING';
                }
            }
        }
        
        console.log(`[LogParser] 最终解析结果: progress=${currentProgress}%, status=${currentStatus}, event=${currentEvent}`);
        
        return {
            progress: currentProgress,
            status: currentStatus,
            event: currentEvent
        };
    },

    /**
     * 估算进度（降级方案）
     * 当日志解析失败时使用
     */
    estimateProgress(type, startTime, estimatedDuration) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / estimatedDuration) * 100);

        return {
            progress: Math.round(progress),
            status: `${type === 'ASR' ? '转写' : '合成'}中...`,
            event: 'ESTIMATED'
        };
    }
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.LogParser = LogParser;
}
