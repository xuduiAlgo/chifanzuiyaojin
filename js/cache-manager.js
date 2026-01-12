/**
 * 缓存管理器模块
 * 实现结果缓存，提升性能，减少重复请求
 */

const CacheManager = {
    // 缓存存储
    storage: {},

    // 默认配置
    defaultConfig: {
        maxSize: 100, // 最大缓存项数
        ttl: 3600000, // 默认过期时间（1小时）
        persistToLocalStorage: false, // 是否持久化到 localStorage
        storageKey: 'app_cache' // localStorage 键名
    },

    /**
     * 初始化缓存管理器
     */
    init(config = {}) {
        this.config = { ...this.defaultConfig, ...config };

        if (this.config.persistToLocalStorage) {
            this.loadFromStorage();
        }

        // 清理过期缓存
        this.cleanupExpired();
    },

    /**
     * 生成缓存键
     */
    generateKey(prefix, params) {
        const paramsStr = JSON.stringify(params);
        const hash = this.hashString(paramsStr);
        return `${prefix}_${hash}`;
    },

    /**
     * 简单的字符串哈希函数
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    },

    /**
     * 设置缓存
     */
    set(key, value, ttl = null) {
        const now = Date.now();
        const expireTime = ttl !== null ? ttl : this.config.ttl;

        // 检查缓存大小
        if (Object.keys(this.storage).length >= this.config.maxSize) {
            this.evictOldest();
        }

        this.storage[key] = {
            value,
            timestamp: now,
            expireTime: now + expireTime,
            hits: 0
        };

        if (this.config.persistToLocalStorage) {
            this.saveToStorage();
        }

        return true;
    },

    /**
     * 获取缓存
     */
    get(key) {
        const item = this.storage[key];

        if (!item) {
            return null;
        }

        // 检查是否过期
        if (Date.now() > item.expireTime) {
            this.delete(key);
            return null;
        }

        // 更新命中次数
        item.hits++;

        return item.value;
    },

    /**
     * 检查缓存是否存在
     */
    has(key) {
        const item = this.storage[key];
        if (!item) return false;

        // 检查是否过期
        if (Date.now() > item.expireTime) {
            this.delete(key);
            return false;
        }

        return true;
    },

    /**
     * 删除缓存
     */
    delete(key) {
        delete this.storage[key];

        if (this.config.persistToLocalStorage) {
            this.saveToStorage();
        }

        return true;
    },

    /**
     * 清除所有缓存
     */
    clear() {
        this.storage = {};

        if (this.config.persistToLocalStorage) {
            this.saveToStorage();
        }

        return true;
    },

    /**
     * 清除指定前缀的缓存
     */
    clearByPrefix(prefix) {
        Object.keys(this.storage).forEach(key => {
            if (key.startsWith(prefix)) {
                delete this.storage[key];
            }
        });

        if (this.config.persistToLocalStorage) {
            this.saveToStorage();
        }
    },

    /**
     * 清理过期缓存
     */
    cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;

        Object.keys(this.storage).forEach(key => {
            if (now > this.storage[key].expireTime) {
                delete this.storage[key];
                cleaned++;
            }
        });

        if (cleaned > 0 && this.config.persistToLocalStorage) {
            this.saveToStorage();
        }

        return cleaned;
    },

    /**
     * 淘汰最旧的缓存项（LRU）
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTimestamp = Infinity;

        Object.entries(this.storage).forEach(([key, item]) => {
            if (item.timestamp < oldestTimestamp) {
                oldestTimestamp = item.timestamp;
                oldestKey = key;
            }
        });

        if (oldestKey) {
            delete this.storage[oldestKey];
        }
    },

    /**
     * 淘汰最少使用的缓存项（LFU）
     */
    evictLeastUsed() {
        let leastUsedKey = null;
        let leastUsedHits = Infinity;

        Object.entries(this.storage).forEach(([key, item]) => {
            if (item.hits < leastUsedHits) {
                leastUsedHits = item.hits;
                leastUsedKey = key;
            }
        });

        if (leastUsedKey) {
            delete this.storage[leastUsedKey];
        }
    },

    /**
     * 获取缓存统计信息
     */
    getStats() {
        const items = Object.values(this.storage);
        const totalSize = items.length;
        const expiredCount = items.filter(item => Date.now() > item.expireTime).length;
        const totalHits = items.reduce((sum, item) => sum + item.hits, 0);

        return {
            totalSize,
            validSize: totalSize - expiredCount,
            expiredCount,
            totalHits,
            maxCacheSize: this.config.maxSize,
            keys: Object.keys(this.storage)
        };
    },

    /**
     * 保存到 localStorage
     */
    saveToStorage() {
        try {
            const data = JSON.stringify(this.storage);
            localStorage.setItem(this.config.storageKey, data);
        } catch (e) {
            console.warn('Failed to save cache to localStorage:', e);
        }
    },

    /**
     * 从 localStorage 加载
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.config.storageKey);
            if (data) {
                this.storage = JSON.parse(data);
            }
        } catch (e) {
            console.warn('Failed to load cache from localStorage:', e);
            this.storage = {};
        }
    },

    /**
     * 缓存装饰器：为异步函数添加缓存功能
     */
    async withCache(asyncFn, key, ttl = null) {
        // 检查缓存
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        // 执行函数
        const result = await asyncFn();

        // 缓存结果
        this.set(key, result, ttl);

        return result;
    },

    /**
     * 创建带缓存的 API 请求函数
     */
    createCachedRequest(url, options = {}, cacheKey = null, ttl = null) {
        return async (requestOptions = {}) => {
            const finalOptions = { ...options, ...requestOptions };
            const key = cacheKey || this.generateKey('api', { url, options: finalOptions });

            return this.withCache(
                async () => {
                    const response = await fetch(url, finalOptions);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return await response.json();
                },
                key,
                ttl
            );
        };
    },

    /**
     * 预热缓存
     */
    async warmup(items) {
        const promises = items.map(async item => {
            try {
                const value = await item.fn();
                this.set(item.key, value, item.ttl);
                return true;
            } catch (e) {
                console.warn(`Failed to warmup cache for key ${item.key}:`, e);
                return false;
            }
        });

        return Promise.all(promises);
    }
};

// 导出预配置的缓存管理器实例
const cache = {
    // API 请求缓存（默认 5 分钟）
    api: (() => {
        const manager = Object.create(CacheManager);
        manager.init({
            maxSize: 50,
            ttl: 300000,
            persistToLocalStorage: false,
            storageKey: 'api_cache'
        });
        return manager;
    })(),

    // AI 分析结果缓存（默认 1 小时）
    ai: (() => {
        const manager = Object.create(CacheManager);
        manager.init({
            maxSize: 20,
            ttl: 3600000,
            persistToLocalStorage: true,
            storageKey: 'ai_cache'
        });
        return manager;
    })(),

    // TTS 生成结果缓存（默认 24 小时）
    tts: (() => {
        const manager = Object.create(CacheManager);
        manager.init({
            maxSize: 30,
            ttl: 86400000,
            persistToLocalStorage: true,
            storageKey: 'tts_cache'
        });
        return manager;
    })()
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.CacheManager = CacheManager;
    window.cache = cache;
}
