// History Manager Module
// Handles saving, loading, and displaying TTS and ASR history

const HistoryManager = {
    STORAGE_KEY: 'chifanzuiyaojin_history',
    
    // Initialize history storage
    init() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
        }
    },
    
    // Get all history records
    getAllHistory() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load history:', e);
            return [];
        }
    },
    
    // Save a new history record
    saveHistory(record) {
        try {
            const history = this.getAllHistory();
            
            // Create new record with ID and timestamp
            const newRecord = {
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
                ...record
            };
            
            // Add to beginning of array
            history.unshift(newRecord);
            
            // Limit to 100 records to prevent storage overflow
            if (history.length > 100) {
                history.splice(100);
            }
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
            
            // Also try to save to server
            this.saveToServer(newRecord);
            
            return newRecord;
        } catch (e) {
            console.error('Failed to save history:', e);
            return null;
        }
    },
    
    // Delete a history record
    deleteHistory(id) {
        try {
            const history = this.getAllHistory();
            const filtered = history.filter(r => r.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
            
            // Also delete from server
            this.deleteFromServer(id);
            
            return true;
        } catch (e) {
            console.error('Failed to delete history:', e);
            return false;
        }
    },
    
    // Get a single history record by ID
    getHistoryById(id) {
        const history = this.getAllHistory();
        return history.find(r => r.id === id) || null;
    },
    
    // Save history to server
    async saveToServer(record) {
        try {
            const response = await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            if (response.ok) {
                const data = await response.json();
                if (data.ok) {
                    console.log('History saved to server:', record.id);
                }
            }
        } catch (e) {
            console.warn('Failed to save history to server:', e);
        }
    },
    
    // Delete history from server
    async deleteFromServer(id) {
        try {
            const response = await fetch('/api/history', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (response.ok) {
                console.log('History deleted from server:', id);
            }
        } catch (e) {
            console.warn('Failed to delete history from server:', e);
        }
    },
    
    // Get history from server
    async loadFromServer() {
        try {
            const response = await fetch('/api/history');
            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.history) {
                    // Merge server history with local history
                    const localHistory = this.getAllHistory();
                    const serverHistory = data.history;
                    
                    // Create a map of existing records
                    const existingMap = new Map(localHistory.map(r => [r.id, r]));
                    
                    // Add or update records from server
                    serverHistory.forEach(record => {
                        existingMap.set(record.id, record);
                    });
                    
                    // Convert back to array and sort by date
                    const merged = Array.from(existingMap.values()).sort((a, b) => {
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    });
                    
                    // Save merged history
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
                    
                    return merged;
                }
            }
            return this.getAllHistory();
        } catch (e) {
            console.warn('Failed to load history from server:', e);
            return this.getAllHistory();
        }
    },
    
    // Format date for display
    formatDate(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        
        // If less than 24 hours, show time
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `今天 ${hours}:${minutes}`;
        }
        
        // Otherwise show date
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    // Get type label
    getTypeLabel(type) {
        switch (type) {
            case 'tts': return 'TTS 语音合成';
            case 'asr': return 'ASR 语音识别';
            default: return type.toUpperCase();
        }
    }
};

// Initialize history manager
HistoryManager.init();
