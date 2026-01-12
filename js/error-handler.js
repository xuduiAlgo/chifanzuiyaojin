/**
 * 统一错误处理模块
 * 提供一致的错误处理、日志记录和用户提示机制
 */

const ErrorHandler = {
    // 错误类型枚举
    ErrorType: {
        NETWORK_ERROR: 'NETWORK_ERROR',
        API_ERROR: 'API_ERROR',
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        FILE_ERROR: 'FILE_ERROR',
        UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    },

    // 错误码映射
    ErrorMessages: {
        NETWORK_ERROR: '网络连接失败，请检查网络设置',
        API_ERROR: 'API 请求失败，请稍后重试',
        VALIDATION_ERROR: '输入验证失败，请检查输入内容',
        FILE_ERROR: '文件处理失败，请检查文件格式和大小',
        UNKNOWN_ERROR: '发生未知错误，请联系管理员'
    },

    /**
     * 创建错误对象
     */
    createError(type, message, details = null) {
        const error = new Error(message || this.ErrorMessages[type] || this.ErrorMessages.UNKNOWN_ERROR);
        error.type = type;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    },

    /**
     * 处理 API 响应错误
     */
    async handleApiError(response, context = '') {
        let errorType = this.ErrorType.API_ERROR;
        let errorMessage = '';
        let details = null;

        try {
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                errorMessage = data.error || `HTTP ${response.status}`;
                details = data;
            } else {
                const text = await response.text();
                errorMessage = `HTTP ${response.status}`;
                details = { text: text.substring(0, 200) };
            }

            // 根据状态码确定错误类型
            if (response.status >= 400 && response.status < 500) {
                errorType = this.ErrorType.VALIDATION_ERROR;
            } else if (response.status >= 500) {
                errorType = this.ErrorType.API_ERROR;
            } else if (response.status === 413) {
                errorType = this.ErrorType.FILE_ERROR;
                errorMessage = '文件大小超过限制';
            }
        } catch (e) {
            errorType = this.ErrorType.UNKNOWN_ERROR;
            errorMessage = '无法解析错误响应';
            details = { originalError: e.message };
        }

        const error = this.createError(errorType, errorMessage, details);
        this.logError(error, context);
        return error;
    },

    /**
     * 处理网络错误
     */
    handleNetworkError(error, context = '') {
        const errorType = this.ErrorType.NETWORK_ERROR;
        const errorMessage = error.message || '网络连接失败';
        
        const wrappedError = this.createError(errorType, errorMessage, {
            originalError: error.message,
            stack: error.stack
        });
        
        this.logError(wrappedError, context);
        return wrappedError;
    },

    /**
     * 处理验证错误
     */
    handleValidationError(message, context = '') {
        const error = this.createError(
            this.ErrorType.VALIDATION_ERROR,
            message,
            { context }
        );
        
        this.logError(error, context);
        return error;
    },

    /**
     * 处理文件错误
     */
    handleFileError(message, details = null, context = '') {
        const error = this.createError(
            this.ErrorType.FILE_ERROR,
            message,
            details
        );
        
        this.logError(error, context);
        return error;
    },

    /**
     * 显示错误给用户
     */
    showError(error, userMessage = null) {
        let message = userMessage;
        
        if (!message) {
            message = error.message || this.ErrorMessages.UNKNOWN_ERROR;
        }

        // 使用更友好的提示方式
        if (typeof alert !== 'undefined') {
            alert(`错误: ${message}`);
        } else {
            console.error('Error:', message);
        }
    },

    /**
     * 记录错误到控制台
     */
    logError(error, context = '') {
        const logData = {
            timestamp: error.timestamp || new Date().toISOString(),
            type: error.type || this.ErrorType.UNKNOWN_ERROR,
            message: error.message,
            context: context,
            details: error.details,
            stack: error.stack
        };

        // 在控制台输出详细错误信息
        console.error('=== Error Handler ===');
        console.error(`Context: ${context}`);
        console.error(`Type: ${logData.type}`);
        console.error(`Message: ${logData.message}`);
        if (logData.details) {
            console.error('Details:', logData.details);
        }
        console.error('======================');

        // 存储错误日志到 localStorage（可选）
        this.saveErrorLog(logData);
    },

    /**
     * 保存错误日志到 localStorage
     */
    saveErrorLog(errorLog) {
        try {
            const maxLogs = 50; // 最多保存50条日志
            const logsKey = 'app_error_logs';
            
            let logs = JSON.parse(localStorage.getItem(logsKey) || '[]');
            logs.unshift(errorLog);
            
            // 限制日志数量
            if (logs.length > maxLogs) {
                logs = logs.slice(0, maxLogs);
            }
            
            localStorage.setItem(logsKey, JSON.stringify(logs));
        } catch (e) {
            // 忽略 localStorage 错误
            console.warn('Failed to save error log:', e);
        }
    },

    /**
     * 获取错误日志
     */
    getErrorLogs() {
        try {
            return JSON.parse(localStorage.getItem('app_error_logs') || '[]');
        } catch (e) {
            console.warn('Failed to get error logs:', e);
            return [];
        }
    },

    /**
     * 清除错误日志
     */
    clearErrorLogs() {
        try {
            localStorage.removeItem('app_error_logs');
        } catch (e) {
            console.warn('Failed to clear error logs:', e);
        }
    },

    /**
     * 异步操作包装器
     * 自动捕获和处理错误
     */
    async wrapAsync(asyncFn, context = '') {
        try {
            return await asyncFn();
        } catch (error) {
            // 如果已经是我们的错误对象，直接使用
            if (error instanceof Error && error.type) {
                throw error;
            }
            
            // 如果是网络错误
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw this.handleNetworkError(error, context);
            }
            
            // 其他错误
            const wrappedError = this.createError(
                this.ErrorType.UNKNOWN_ERROR,
                error.message || '操作失败',
                { originalError: error.message, stack: error.stack }
            );
            this.logError(wrappedError, context);
            throw wrappedError;
        }
    }
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
}
