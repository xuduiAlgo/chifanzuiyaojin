/**
 * 进度追踪管理器
 * 基于日志轮询实现实时进度追踪
 */

const ProgressTracker = {
    /**
     * 创建进度追踪器
     */
    createTracker(options = {}) {
        const {
            type = 'ASR', // 'ASR' 或 'TTS'
            pollInterval = 1000, // 轮询间隔(ms)
            estimatedDuration = 60000, // 预估总时长(ms),用于降级模式
            onProgress = null, // 进度回调 (progress, status)
            onComplete = null, // 完成回调 (success, result)
            onError = null, // 错误回调 (error)
            maxRetries = 3, // 最大重试次数
            useFallback = true // 是否启用降级模式
        } = options;

        let pollTimer = null;
        let isRunning = false;
        let lastProgress = 0;
        let consecutiveErrors = 0;
        let startTime = Date.now();
        let usingFallback = false;
        let taskId = null; // 任务ID，用于过滤日志

        /**
         * 获取日志
         */
        async function fetchLogs() {
            try {
                let url = '/api/logs?lines=50';
                // 如果有taskId，添加filter参数来过滤日志
                if (taskId) {
                    url += `&filter=Task ID: ${taskId}`;
                }
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                return data.ok ? data.logs : [];
            } catch (error) {
                console.error('Failed to fetch logs:', error);
                throw error;
            }
        }

        /**
         * 更新进度
         */
        function updateProgress(progress, status) {
            // 确保进度不回退
            if (progress > lastProgress) {
                lastProgress = progress;
                if (onProgress) {
                    onProgress(progress, status);
                }
            }
        }

        /**
         * 切换到降级模式
         */
        function switchToFallback() {
            if (usingFallback || !useFallback) return;
            
            console.log('Switching to fallback estimation mode');
            usingFallback = true;
            
            // 停止日志轮询
            stopPolling();
            
            // 开始基于时间的估算
            pollTimer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(100, (elapsed / estimatedDuration) * 100);
                const status = `${type === 'ASR' ? '转写' : '合成'}中... (估算)`;
                
                updateProgress(progress, status);
                
                if (progress >= 100) {
                    completePolling(true);
                }
            }, pollInterval);
        }

        /**
         * 轮询一次
         */
        async function pollOnce() {
            if (!isRunning) return;

            try {
                // 获取日志
                const logs = await fetchLogs();
                
                // 重置错误计数
                consecutiveErrors = 0;
                
                // 解析日志获取进度（传递taskId用于验证）
                const parsed = window.LogParser.parseLogs(logs, type, taskId);
                
                // 检查是否完成
                if (parsed.event === 'COMPLETE' || parsed.progress >= 100) {
                    completePolling(true);
                    return;
                }
                
                // 更新进度
                updateProgress(parsed.progress, parsed.status);
                
            } catch (error) {
                consecutiveErrors++;
                console.error(`Poll error (${consecutiveErrors}/${maxRetries}):`, error);
                
                if (consecutiveErrors >= maxRetries) {
                    console.error('Max retries reached, switching to fallback mode');
                    switchToFallback();
                }
            }
        }

        /**
         * 完成轮询
         */
        function completePolling(success) {
            stopPolling();
            isRunning = false;
            
            // 确保进度为100%
            updateProgress(100, '完成');
            
            if (onComplete) {
                onComplete(success, { usingFallback, lastProgress });
            }
        }

        /**
         * 停止轮询
         */
        function stopPolling() {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }

        /**
         * 开始追踪
         */
        function start() {
            if (isRunning) {
                console.warn('Tracker already running');
                return;
            }
            
            isRunning = true;
            lastProgress = 0;
            consecutiveErrors = 0;
            startTime = Date.now();
            usingFallback = false;
            
            // 立即执行一次
            pollOnce();
            
            // 开始轮询
            pollTimer = setInterval(pollOnce, pollInterval);
            
            // 设置超时保护（基于预估时长+50%缓冲）
            const timeoutDuration = estimatedDuration * 1.5;
            setTimeout(() => {
                if (isRunning) {
                    console.warn('Tracker timeout, forcing completion');
                    completePolling(true);
                }
            }, timeoutDuration);
        }

        /**
         * 停止追踪
         */
        function stop() {
            stopPolling();
            isRunning = false;
        }

        /**
         * 重置追踪器
         */
        function reset() {
            stop();
            lastProgress = 0;
            consecutiveErrors = 0;
            usingFallback = false;
            startTime = Date.now();
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

        /**
         * 获取当前状态
         */
        function getStatus() {
            return {
                isRunning,
                lastProgress,
                consecutiveErrors,
                usingFallback,
                elapsed: Date.now() - startTime,
                taskId
            };
        }

        return {
            start,
            stop,
            reset,
            getStatus,
            setTaskId
        };
    },

    /**
     * 创建ASR进度追踪器（便捷方法）
     */
    createASRTracker(options = {}) {
        return this.createTracker({
            type: 'ASR',
            pollInterval: 1000,
            estimatedDuration: 60000, // 默认60秒
            ...options
        });
    },

    /**
     * 创建TTS进度追踪器（便捷方法）
     */
    createTTSTracker(options = {}) {
        return this.createTracker({
            type: 'TTS',
            pollInterval: 1000,
            estimatedDuration: 30000, // 默认30秒
            ...options
        });
    }
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.ProgressTracker = ProgressTracker;
}
