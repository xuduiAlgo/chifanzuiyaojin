/**
 * 进度指示器模块
 * 为长时间操作提供可视化进度反馈
 */

const ProgressIndicator = {
    /**
     * 创建进度条容器
     */
    createProgressContainer(options = {}) {
        const {
            showPercentage = true,
            showText = true,
            showCancel = false,
            onCancel = null
        } = options;

        const container = document.createElement('div');
        container.className = 'progress-container';
        container.style.cssText = `
            display: none;
            flex-direction: column;
            gap: 8px;
            padding: 16px;
            margin: 16px 0;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            align-items: center;
        `;

        // 进度条
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.cssText = `
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
        `;

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #007bff, #0056b3);
            border-radius: 4px;
            transition: width 0.3s ease;
        `;

        progressBar.appendChild(progressFill);

        // 信息容器
        const infoContainer = document.createElement('div');
        infoContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            gap: 12px;
        `;

        // 状态文本
        const statusText = document.createElement('span');
        statusText.className = 'progress-status-text';
        statusText.style.cssText = `
            font-size: 0.9em;
            color: #495057;
            flex: 1;
        `;

        // 百分比文本
        const percentageText = document.createElement('span');
        percentageText.className = 'progress-percentage-text';
        percentageText.style.cssText = `
            font-size: 0.9em;
            font-weight: bold;
            color: #007bff;
            min-width: 50px;
            text-align: right;
        `;

        if (!showPercentage) {
            percentageText.style.display = 'none';
        }

        if (!showText) {
            statusText.style.display = 'none';
        }

        infoContainer.appendChild(statusText);
        infoContainer.appendChild(percentageText);

        // 取消按钮
        let cancelButton = null;
        if (showCancel && onCancel) {
            cancelButton = document.createElement('button');
            cancelButton.className = 'progress-cancel-button';
            cancelButton.textContent = '取消';
            cancelButton.style.cssText = `
                padding: 6px 12px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85em;
                transition: background 0.2s;
            `;

            cancelButton.addEventListener('mouseenter', () => {
                cancelButton.style.background = '#c82333';
            });

            cancelButton.addEventListener('mouseleave', () => {
                cancelButton.style.background = '#dc3545';
            });

            cancelButton.addEventListener('click', onCancel);

            infoContainer.appendChild(cancelButton);
        }

        container.appendChild(progressBar);
        container.appendChild(infoContainer);

        return {
            container,
            progressFill,
            statusText,
            percentageText,
            cancelButton
        };
    },

    /**
     * 显示进度容器
     */
    show(container) {
        container.style.display = 'flex';
    },

    /**
     * 隐藏进度容器
     */
    hide(container) {
        container.style.display = 'none';
    },

    /**
     * 更新进度
     */
    updateProgress(container, percentage, statusText = '') {
        const progressFill = container.querySelector('.progress-fill');
        const textElement = container.querySelector('.progress-status-text');
        const percentageElement = container.querySelector('.progress-percentage-text');

        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        if (textElement && statusText) {
            textElement.textContent = statusText;
        }

        if (percentageElement) {
            percentageElement.textContent = `${Math.round(percentage)}%`;
        }
    },

    /**
     * 设置完成状态
     */
    setComplete(container, success = true) {
        const progressFill = container.querySelector('.progress-fill');
        const textElement = container.querySelector('.progress-status-text');
        const percentageElement = container.querySelector('.progress-percentage-text');

        if (progressFill) {
            progressFill.style.width = '100%';
            progressFill.style.background = success 
                ? 'linear-gradient(90deg, #28a745, #20c997)' 
                : 'linear-gradient(90deg, #dc3545, #c82333)';
        }

        if (textElement) {
            textElement.textContent = success ? '✓ 完成' : '✗ 失败';
            textElement.style.color = success ? '#28a745' : '#dc3545';
        }

        if (percentageElement) {
            percentageElement.textContent = '100%';
        }

        // 2秒后自动隐藏
        setTimeout(() => {
            this.hide(container);
        }, 2000);
    },

    /**
     * 创建并返回一个进度管理器
     */
    createManager(options = {}) {
        const {
            parentElement = document.body,
            showPercentage = true,
            showText = true,
            showCancel = false,
            onCancel = null
        } = options;

        const { container } = this.createProgressContainer({
            showPercentage,
            showText,
            showCancel,
            onCancel
        });

        parentElement.appendChild(container);

        let isCancelled = false;
        let currentProgress = 0;

        return {
            /**
             * 显示进度条
             */
            show() {
                ProgressIndicator.show(container);
                isCancelled = false;
                currentProgress = 0;
                ProgressIndicator.updateProgress(container, 0, '准备中...');
            },

            /**
             * 隐藏进度条
             */
            hide() {
                ProgressIndicator.hide(container);
            },

            /**
             * 更新进度
             */
            update(percentage, statusText = '') {
                if (isCancelled) return false;
                currentProgress = percentage;
                ProgressIndicator.updateProgress(container, percentage, statusText);
                return true;
            },

            /**
             * 增加进度
             */
            increment(amount = 1, statusText = '') {
                if (isCancelled) return false;
                currentProgress = Math.min(100, currentProgress + amount);
                ProgressIndicator.updateProgress(container, currentProgress, statusText);
                return true;
            },

            /**
             * 标记为完成
             */
            complete(success = true) {
                if (!isCancelled) {
                    ProgressIndicator.setComplete(container, success);
                }
            },

            /**
             * 取消操作
             */
            cancel() {
                isCancelled = true;
                ProgressIndicator.updateProgress(container, currentProgress, '已取消');
                setTimeout(() => {
                    ProgressIndicator.hide(container);
                }, 1000);
            },

            /**
             * 检查是否已取消
             */
            isCancelled() {
                return isCancelled;
            },

            /**
             * 销毁进度条
             */
            destroy() {
                container.remove();
            }
        };
    }
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.ProgressIndicator = ProgressIndicator;
}
