/**
 * 前端单元测试
 * 使用 Jest 测试框架
 */

// 引入被测试的模块
// 注意：这些测试需要在浏览器环境或使用 jsdom 运行

describe('Utils Module', () => {
    
    describe('formatTime', () => {
        test('应该正确格式化时间', () => {
            expect(Utils.formatTime(0)).toBe('0分0秒');
            expect(Utils.formatTime(65)).toBe('1分5秒');
            expect(Utils.formatTime(125)).toBe('2分5秒');
            expect(Utils.formatTime(3600)).toBe('60分0秒');
        });
    });

    describe('findTimestampBySnippet', () => {
        const mockSubtitles = [
            { text: '第一句话', start: 0, end: 2 },
            { text: '第二句话', start: 2, end: 4 },
            { text: '第三句话', start: 4, end: 6 }
        ];

        test('应该能找到精确匹配的时间戳', () => {
            const result = Utils.findTimestampBySnippet('第一句话', mockSubtitles);
            expect(result).toBe(0);
        });

        test('应该在未找到时返回 null', () => {
            const result = Utils.findTimestampBySnippet('不存在的内容', mockSubtitles);
            expect(result).toBeNull();
        });

        test('应该能处理空字幕数组', () => {
            const result = Utils.findTimestampBySnippet('测试', []);
            expect(result).toBeNull();
        });
    });

    describe('showLoading', () => {
        let mockElement;

        beforeEach(() => {
            mockElement = {
                disabled: false,
                textContent: '原始文本'
            };
        });

        test('应该禁用元素并更新文本', () => {
            Utils.showLoading(mockElement, '加载中...');
            expect(mockElement.disabled).toBe(true);
            expect(mockElement.textContent).toBe('加载中...');
        });

        test('应该禁用元素但不更新文本', () => {
            Utils.showLoading(mockElement);
            expect(mockElement.disabled).toBe(true);
            expect(mockElement.textContent).toBe('原始文本');
        });
    });

    describe('hideLoading', () => {
        let mockElement;

        beforeEach(() => {
            mockElement = {
                disabled: true,
                textContent: '加载中...'
            };
        });

        test('应该启用元素并恢复文本', () => {
            Utils.hideLoading(mockElement, '原始文本');
            expect(mockElement.disabled).toBe(false);
            expect(mockElement.textContent).toBe('原始文本');
        });

        test('应该启用元素但不恢复文本', () => {
            Utils.hideLoading(mockElement);
            expect(mockElement.disabled).toBe(false);
            expect(mockElement.textContent).toBe('加载中...');
        });
    });
});

describe('UI Module', () => {
    
    describe('renderKeywords', () => {
        let mockContainer;

        beforeEach(() => {
            mockContainer = {
                innerHTML: '',
                appendChild: jest.fn()
            };
        });

        test('应该渲染关键词标签', () => {
            const keywords = ['关键词1', '关键词2', '关键词3'];
            UI.renderKeywords(keywords, mockContainer);
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(3);
        });

        test('应该处理空关键词数组', () => {
            UI.renderKeywords([], mockContainer);
            expect(mockContainer.appendChild).not.toHaveBeenCalled();
        });

        test('应该处理 undefined', () => {
            UI.renderKeywords(undefined, mockContainer);
            expect(mockContainer.appendChild).not.toHaveBeenCalled();
        });
    });

    describe('renderTopics', () => {
        let mockContainer;
        let mockPlayer;
        let mockSubtitles;

        beforeEach(() => {
            mockContainer = {
                innerHTML: '',
                appendChild: jest.fn()
            };
            mockPlayer = {
                currentTime: 0,
                play: jest.fn()
            };
            mockSubtitles = [
                { text: '测试内容', start: 0, end: 2 }
            ];
        });

        test('应该渲染主题列表', () => {
            const topics = [
                { title: '主题1', start_snippet: '测试内容' }
            ];
            UI.renderTopics(topics, mockSubtitles, mockContainer, mockPlayer);
            expect(mockContainer.appendChild).toHaveBeenCalled();
        });

        test('应该处理空主题数组', () => {
            UI.renderTopics([], mockSubtitles, mockContainer, mockPlayer);
            expect(mockContainer.appendChild).not.toHaveBeenCalled();
        });
    });

    describe('renderAdviceContent', () => {
        let mockContainer;

        beforeEach(() => {
            mockContainer = {
                innerHTML: '',
                appendChild: jest.fn()
            };
        });

        test('应该渲染完整的建议内容', () => {
            const adviceData = {
                score_prediction: '85分',
                analysis: '这是一篇好文章',
                structure_advice: '结构清晰',
                alternative_ideas: [
                    { title: '想法1', desc: '描述1' }
                ],
                suggestions: [
                    {
                        technique: '修辞',
                        original: '原文',
                        suggestion: '建议',
                        refined_text: '**修改后**'
                    }
                ],
                style_demonstrations: [
                    {
                        style_name: '中考风格',
                        examples: [
                            {
                                original_snippet: '原文',
                                refined_text: '修改后',
                                comment: '解析'
                            }
                        ]
                    }
                ]
            };

            UI.renderAdviceContent(adviceData, mockContainer);
            expect(mockContainer.appendChild).toHaveBeenCalled();
        });

        test('应该处理最小的建议数据', () => {
            const adviceData = {
                analysis: '简单分析'
            };

            UI.renderAdviceContent(adviceData, mockContainer);
            expect(mockContainer.innerHTML).toContain('简单分析');
        });
    });
});
