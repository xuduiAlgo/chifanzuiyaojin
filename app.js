const ui = {
  text: document.getElementById("text"),
  pdfFile: document.getElementById("pdfFile"),
  importPdf: document.getElementById("importPdf"),
  urlInput: document.getElementById("urlInput"),
  importUrl: document.getElementById("importUrl"),
  sayVoice: document.getElementById("sayVoice"),
  filename: document.getElementById("filename"),
  generateAudio: document.getElementById("generateAudio"),
  downloadLink: document.getElementById("downloadLink"),
  audioPlayer: document.getElementById("audioPlayer"),
  statusText: document.getElementById("statusText"),
  fixPunctuation: document.getElementById("fixPunctuation"),
  highlightContainer: document.getElementById("highlightContainer"),
  dashscopeKey: document.getElementById("dashscopeKey"),
  voicePrompt: document.getElementById("voicePrompt"),
  voicePromptField: document.getElementById("voicePromptField"),
  analysisSection: document.getElementById("analysisSection"),
  analysisKeywords: document.getElementById("analysisKeywords"),
  analysisSummary: document.getElementById("analysisSummary"),
  analysisTopics: document.getElementById("analysisTopics"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  ocrFile: document.getElementById("ocrFile"),
  ocrFileList: document.getElementById("ocrFileList"),
  clearOcrFiles: document.getElementById("clearOcrFiles"),
  startOcr: document.getElementById("startOcr"),
  ocrResult: document.getElementById("ocrResult"),
  ocrResultText: document.getElementById("ocrResultText"),
  generateWord: document.getElementById("generateWord"),
  customPrompt: document.getElementById("customPrompt"),
  submitCustomPrompt: document.getElementById("submitCustomPrompt"),
  defaultPrompt1: document.getElementById("defaultPrompt1"),
  defaultPrompt2: document.getElementById("defaultPrompt2"),
  defaultPrompt3: document.getElementById("defaultPrompt3"),
  getAiAdvice: document.getElementById("getAiAdvice"),
  adviceSection: document.getElementById("adviceSection"),
  adviceAnalysis: document.getElementById("adviceAnalysis"),
  adviceList: document.getElementById("adviceList"),
  exportAdvice: document.getElementById("exportAdvice"),
  ocrStatus: document.getElementById("ocrStatus"),
  asrFile: document.getElementById("asrFile"),
  startAsr: document.getElementById("startAsr"),
  asrUrl: document.getElementById("asrUrl"),
  startAsrUrl: document.getElementById("startAsrUrl"),
  asrResultSection: document.getElementById("asrResultSection"),
  asrAudioPlayer: document.getElementById("asrAudioPlayer"),
  asrVideoPlayer: document.getElementById("asrVideoPlayer"),
  asrKeywords: document.getElementById("asrKeywords"),
  asrSummary: document.getElementById("asrSummary"),
  asrTopics: document.getElementById("asrTopics"),
  asrText: document.getElementById("asrText"),
  asrInteractive: document.getElementById("asrInteractive"),
  showAsrInteractive: document.getElementById("showAsrInteractive"),
  showAsrEditable: document.getElementById("showAsrEditable"),
  exportAsrDoc: document.getElementById("exportAsrDoc"),
  asrStatus: document.getElementById("asrStatus"),
  // Progress bar elements
  ttsProgressContainer: document.getElementById("ttsProgressContainer"),
  ttsProgressLabel: document.getElementById("ttsProgressLabel"),
  ttsProgressPercent: document.getElementById("ttsProgressPercent"),
  ttsProgressBar: document.getElementById("ttsProgressBar"),
  asrProgressContainer: document.getElementById("asrProgressContainer"),
  asrProgressLabel: document.getElementById("asrProgressLabel"),
  asrProgressPercent: document.getElementById("asrProgressPercent"),
  asrProgressBar: document.getElementById("asrProgressBar"),
};

const state = {
  sayVoices: [],
  subtitles: [],
  asrSubtitles: [],
  pdfJsReady: false
};

// --- Progress Bar Helper Functions ---

function updateProgress(type, percentage, label = "预估完成时间") {
  const container = type === 'tts' ? ui.ttsProgressContainer : ui.asrProgressContainer;
  const progressBar = type === 'tts' ? ui.ttsProgressBar : ui.asrProgressBar;
  const percentText = type === 'tts' ? ui.ttsProgressPercent : ui.asrProgressPercent;
  const labelText = type === 'tts' ? ui.ttsProgressLabel : ui.asrProgressLabel;
  
  if (!container || !progressBar || !percentText) return;
  
  // Show container
  container.classList.remove('hidden');
  
  // Update width
  progressBar.style.width = `${percentage}%`;
  percentText.textContent = `${Math.round(percentage)}%`;
  labelText.textContent = label;
  
  // Update color based on percentage
  progressBar.className = 'progress-fill active';
  if (percentage < 30) {
    progressBar.style.background = '#ff5b6b'; // Red
  } else if (percentage < 70) {
    progressBar.style.background = 'linear-gradient(90deg, #ff5b6b 0%, #ffa94d 100%)'; // Orange
  } else if (percentage < 100) {
    progressBar.style.background = 'linear-gradient(90deg, #ffa94d 0%, #22c55e 100%)'; // Yellow to Green
  } else {
    progressBar.style.background = '#22c55e'; // Green
    progressBar.classList.remove('active'); // Remove animation when complete
  }
}

function hideProgress(type) {
  const container = type === 'tts' ? ui.ttsProgressContainer : ui.asrProgressContainer;
  if (container) {
    container.classList.add('hidden');
  }
}

function setStatus(text) {
  if (ui.statusText) ui.statusText.textContent = text;
}

// --- Tabs Logic ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        // Show target tab content
        const targetId = btn.dataset.target;
        document.getElementById(targetId).classList.remove('hidden');
    });
});

// --- Utils ---

function defaultFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `tts-${stamp}.wav`;
}

// --- API Interactions ---

async function loadVoices() {
  try {
    const res = await fetch(`/api/voices`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.voices)) {
      state.sayVoices = data.voices;
      renderVoiceSelect();
    }
  } catch (e) {
    console.error("Failed to load voices:", e);
  }
}

function renderVoiceSelect() {
  const previousValue = ui.sayVoice.value;
  ui.sayVoice.innerHTML = "";
  
  state.sayVoices.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.description ? v.description : v.name;
      ui.sayVoice.appendChild(opt);
  });

  if (previousValue && state.sayVoices.some(v => v.name === previousValue)) {
      ui.sayVoice.value = previousValue;
  }
  
  // Trigger change for prompt field
  ui.sayVoice.dispatchEvent(new Event('change'));
}

ui.sayVoice.addEventListener("change", () => {
    if (ui.sayVoice.value === "cosyvoice-instruct") {
        ui.voicePromptField.classList.remove("hidden");
    } else {
        ui.voicePromptField.classList.add("hidden");
    }
});

// --- TTS Generation ---

async function generateAudio() {
  const text = (ui.text.value ?? "").trim();
  if (!text) {
    setStatus("请输入要生成音频的文本。");
    return;
  }

  const filename = (ui.filename.value ?? "").trim() || defaultFilename();
  let voice = ui.sayVoice.value;
  const dashscopeKey = (ui.dashscopeKey.value ?? "").trim();
  const voicePrompt = (ui.voicePrompt.value ?? "").trim();
  
  if (!dashscopeKey) {
      alert("请先配置 Alibaba DashScope Key。");
      return;
  }
  
  if (voice === "cosyvoice-instruct" && voicePrompt) {
      voice = "instruct:" + voicePrompt;
  }

  ui.generateAudio.disabled = true;
  ui.downloadLink.classList.add("disabled");
  state.subtitles = [];
  ui.highlightContainer.classList.add("hidden");
  
  setStatus("正在生成语音 (Qwen-TTS)...");
  
  // Show progress bar
  updateProgress('tts', 5, "正在准备生成...");
  
  // 创建TTS进度追踪器
  const ttsTracker = window.ProgressTracker.createTTSTracker({
    estimatedDuration: Math.max(30000, text.length * 50), // 基于文本长度估算
    onProgress: (progress, status) => {
      updateProgress('tts', progress, status);
    },
    onComplete: (success, result) => {
      console.log('TTS tracking completed:', result);
      if (result.usingFallback) {
        console.log('TTS used fallback estimation mode');
      }
    }
  });
  
  ttsTracker.start();
  
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
          text, 
          voice, 
          filename,
          dashscopeKey
      }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok) {
      ttsTracker.stop();
      throw new Error(data.error);
    }
    
    // 停止进度追踪
    ttsTracker.stop();
    
    // Update progress to show completion
    updateProgress('tts', 100, "生成完成！");
    
    // Hide progress bar after a short delay
    setTimeout(() => hideProgress('tts'), 1500);
    
    // Success
    ui.audioPlayer.src = data.audio_url;
    ui.audioPlayer.play().catch(e => console.warn("Auto-play blocked:", e));
    
    ui.downloadLink.href = data.audio_url;
    ui.downloadLink.download = data.download_filename;
    ui.downloadLink.classList.remove("disabled");
    
    if (data.subtitles && data.subtitles.length > 0) {
        state.subtitles = data.subtitles;
        renderHighlights();
    } else {
        ui.highlightContainer.classList.remove("hidden");
        ui.highlightContainer.textContent = "（未生成时间戳，可能是该模式不支持或文本过短）";
    }
    
    setStatus("生成成功！");
    
    // Save to history
    const historyRecord = {
        type: 'tts',
        text: ui.text.value,
        voice: ui.sayVoice.value,
        filename: filename,
        audioUrl: data.audio_url,
        downloadFilename: data.download_filename,
        subtitles: data.subtitles || [],
        analysis: null // Will be filled after analysis completes
    };
    HistoryManager.saveHistory(historyRecord);
    
    // Trigger Analysis
    analyzeText();
    
  } catch (e) {
    setStatus("生成失败: " + e.message);
    ttsTracker.stop();
    hideProgress('tts');
  } finally {
    ui.generateAudio.disabled = false;
  }
}

ui.generateAudio.addEventListener("click", generateAudio);

// --- Click to Seek Logic ---
ui.highlightContainer.addEventListener("click", (e) => {
    const target = e.target.closest(".word-span");
    if (!target) return;
    
    const start = parseFloat(target.dataset.start);
    if (!isNaN(start)) {
        ui.audioPlayer.currentTime = start;
        ui.audioPlayer.play();
    }
});

// --- Highlighting Logic ---

function renderHighlights() {
    ui.highlightContainer.classList.remove("hidden");
    ui.highlightContainer.innerHTML = "";
    
    state.subtitles.forEach((sub, idx) => {
        const span = document.createElement("span");
        span.textContent = sub.text; 
        span.className = "word-span";
        span.dataset.idx = idx;
        span.dataset.start = sub.start;
        span.dataset.end = sub.end;
        ui.highlightContainer.appendChild(span);
    });
}

function updateHighlight(time) {
    if (!state.subtitles.length) return;
    const activeIdx = state.subtitles.findIndex(s => time >= s.start && time <= s.end);
    
    const currentActive = ui.highlightContainer.querySelector(".word-span.active");
    if (currentActive && currentActive.dataset.idx != activeIdx) {
        currentActive.classList.remove("active");
    }
    
    if (activeIdx !== -1) {
        const target = ui.highlightContainer.querySelector(`.word-span[data-idx="${activeIdx}"]`);
        if (target) {
            target.classList.add("active");
            // Only scroll the container, not the whole page
            const container = ui.highlightContainer;
            
            // Check if element is out of visible bounds relative to container
            const eleTop = target.offsetTop;
            const eleBottom = target.offsetTop + target.offsetHeight;
            const containerTop = container.scrollTop;
            const containerBottom = container.scrollTop + container.clientHeight;
            
            if (eleTop < containerTop || eleBottom > containerBottom) {
                // Center the element in the container
                container.scrollTo({
                    top: target.offsetTop - container.clientHeight / 2 + target.offsetHeight / 2,
                    behavior: 'smooth'
                });
            }
        }
    }
}

ui.audioPlayer.addEventListener("timeupdate", () => updateHighlight(ui.audioPlayer.currentTime));

// --- NLP Analysis ---

async function analyzeText() {
    const text = (ui.text.value ?? "").trim();
    const dashscopeKey = (ui.dashscopeKey.value ?? "").trim();
    
    if (!text || !dashscopeKey) return;
    
    ui.analysisSection.classList.remove("hidden");
    ui.analysisKeywords.innerHTML = "分析中...";
    ui.analysisSummary.textContent = "分析中...";
    ui.analyzeBtn.disabled = true;
    
    try {
        const res = await fetch("/api/analyze-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, dashscopeKey })
        });
        
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        
        const result = data.data;
        
        // Keywords
        ui.analysisKeywords.innerHTML = "";
        (result.keywords || []).forEach(kw => {
            const tag = document.createElement("span");
            tag.className = "keyword-tag";
            tag.textContent = kw;
            ui.analysisKeywords.appendChild(tag);
        });
        
        // Summary
        ui.analysisSummary.textContent = result.summary || "（无摘要）";
        
        // Topics
        ui.analysisTopics.innerHTML = "";
        
        // Helper to format time
        const formatTime = (seconds) => {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}分${s}秒`;
        };
        
        // Update the latest TTS history record with analysis data
        const history = HistoryManager.getAllHistory();
        if (history.length > 0 && history[0].type === 'tts' && !history[0].analysis) {
            history[0].analysis = {
                keywords: result.keywords || [],
                summary: result.summary || "",
                topics: result.topics || []
            };
            localStorage.setItem(HistoryManager.STORAGE_KEY, JSON.stringify(history));
            
            // Also try to update on server
            HistoryManager.saveToServer(history[0]);
        }

        (result.topics || []).forEach(topic => {
            const li = document.createElement("li");
            li.className = "topic-item";
            
            // Find timestamps based on snippets
            let startT = 0, endT = 0;
            let found = false;
            
            if (topic.start_snippet && state.subtitles.length > 0) {
                // Improved matching: normalize both strings
                const cleanSnippet = topic.start_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                // Increase search length to ensure uniqueness, but not too long to fail
                const snippetLen = Math.min(cleanSnippet.length, 15);
                const searchStr = cleanSnippet.substring(0, snippetLen);
                
                // Find start subtitle
                let matchIdx = -1;
                
                // 1. Try exact match of first few chars in clean text
                matchIdx = state.subtitles.findIndex(s => {
                    const cleanSub = s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                    return cleanSub.includes(searchStr);
                });
                
                // 2. Fuzzy fallback: sliding window across ALL subtitles joined together
                if (matchIdx === -1) {
                    // This is computationally heavier but necessary if boundaries don't align
                    // Construct a giant string of all clean subtitles with their indices
                    // Simplified: just search locally in a loop
                    for (let i = 0; i < state.subtitles.length; i++) {
                         // Check combined text of i and i+1 to handle boundary splits
                         let combined = state.subtitles[i].text;
                         if (i + 1 < state.subtitles.length) combined += state.subtitles[i+1].text;
                         const cleanCombined = combined.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                         
                         if (cleanCombined.includes(searchStr)) {
                             matchIdx = i;
                             break;
                         }
                    }
                }
                
                if (matchIdx !== -1) {
                    startT = state.subtitles[matchIdx].start;
                    found = true;
                    
                    // Try to find end time if end_snippet exists, otherwise just use next topic or arbitrary
                    if (topic.end_snippet) {
                         const cleanEnd = topic.end_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").substring(0, 10);
                         let endMatchIdx = state.subtitles.findIndex((s, idx) => idx > matchIdx && s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").includes(cleanEnd));
                         if (endMatchIdx !== -1) {
                             endT = state.subtitles[endMatchIdx].end;
                         }
                    }
                }
            }
            
            // Render
            let timeInfo = "";
            if (found) {
                const timeStr = endT > startT ? `${formatTime(startT)}~${formatTime(endT)}` : `${formatTime(startT)}`;
                timeInfo = `<span style="color:var(--primary); font-size:0.85em; margin-left:8px;">[${timeStr}]</span>`;
                
                // Bind click
                li.style.cursor = "pointer";
                li.title = `点击跳转到 ${formatTime(startT)}`;
                li.addEventListener("click", () => {
                    ui.audioPlayer.currentTime = startT;
                    ui.audioPlayer.play();
                });
            } else {
                 timeInfo = `<span style="color:var(--muted); font-size:0.85em; margin-left:8px;">[未匹配]</span>`;
            }

            li.innerHTML = `<span>${topic.title}</span>${timeInfo}`;
            ui.analysisTopics.appendChild(li);
        });
        
    } catch (e) {
        ui.analysisSummary.textContent = "分析失败: " + e.message;
    } finally {
        ui.analyzeBtn.disabled = false;
    }
}

ui.analyzeBtn.addEventListener("click", analyzeText);

// --- Punctuation (Internal) ---

async function fixPunctuationInternal(text, dashscopeKey) {
    if (!text || !dashscopeKey) return text;
    
    try {
        const res = await fetch("/api/fix-punctuation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, dashscopeKey })
        });
        const data = await res.json();
        if (data.ok) {
            return data.text;
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        throw e;
    }
}

// --- ASR ---

async function startAsr() {
    const file = ui.asrFile.files[0];
    const dashscopeKey = ui.dashscopeKey.value.trim();
    if (!file || !dashscopeKey) {
        alert("请选择文件并配置 API Key。");
        return;
    }

  ui.startAsr.disabled = true;
  ui.startAsr.textContent = "转写中...";
  ui.asrStatus.textContent = "正在上传并转写 (Qwen3-Omni-Flash)...";
  ui.asrResultSection.classList.add("hidden");

  // Show progress bar
  updateProgress('asr', 5, "正在准备上传...");
  
  // 创建ASR进度追踪器（不带taskId，因为服务器返回后才知）
  const asrTracker = window.ProgressTracker.createASRTracker({
    estimatedDuration: Math.max(60000, file.size / 100000 * 60), // 基于文件大小估算(1MB约60秒)
    onProgress: (progress, status) => {
      updateProgress('asr', progress, status);
    },
    onComplete: (success, result) => {
      console.log('ASR tracking completed:', result);
      if (result.usingFallback) {
        console.log('ASR used fallback estimation mode');
      }
    }
  });
  
  asrTracker.start();
  
  const form = new FormData();
  form.append("file", file);
  form.append("dashscopeKey", dashscopeKey);

  try {
    const res = await fetch("/api/asr", { method: "POST", body: form });
    
    const data = await res.json();
    
    if (!data.ok) {
      asrTracker.stop();
      throw new Error(data.error || "转写失败");
    }
    
    // 获取服务器返回的task_id
    const taskId = data.task_id;
    console.log('ASR Task ID:', taskId);
    
    // 更新tracker的taskId以过滤日志
    if (taskId && asrTracker.setTaskId) {
      asrTracker.setTaskId(taskId);
    }
    
    // 停止进度追踪
    asrTracker.stop();
    
    // Update progress to show completion
    updateProgress('asr', 100, "转写完成！");
    
    // Hide progress bar after a short delay
    setTimeout(() => hideProgress('asr'), 1500);
        
        ui.asrResultSection.classList.remove("hidden");
        ui.asrText.value = data.transcript;
        
        state.asrSubtitles = data.subtitles || [];
        renderAsrInteractive();
        ui.showAsrInteractive.click();
        
        ui.asrKeywords.innerHTML = "";
        (data.keywords || []).forEach(kw => {
            const tag = document.createElement("span");
            tag.className = "keyword-tag";
            tag.textContent = kw;
            // Add a space after the keyword if it's not the last one
            // Wait, span style is flex/inline-block. 
            // The user wants "space separated" VISUALLY or TEXTUALLY?
            // "ASR转录之后的关键词提取展示，需要关键词之间用空格隔开。"
            // Current CSS for .keyword-tag might be pills.
            // Let's just add margin-right in style.css or here.
            tag.style.marginRight = "8px"; 
            ui.asrKeywords.appendChild(tag);
        });
        
        ui.asrSummary.textContent = data.summary || "（无摘要）";

        // Topics (Copied from TTS logic)
        ui.asrTopics.innerHTML = "";
        
        // Helper to format time (same as TTS)
        const formatTime = (seconds) => {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}分${s}秒`;
        };

        (data.topics || []).forEach(topic => {
            const li = document.createElement("li");
            li.className = "topic-item";
            
            // Find timestamps based on snippets
            let startT = 0, endT = 0;
            let found = false;
            
            if (topic.start_snippet && state.asrSubtitles.length > 0) {
                // Improved matching: normalize both strings
                const cleanSnippet = topic.start_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                const snippetLen = Math.min(cleanSnippet.length, 15);
                const searchStr = cleanSnippet.substring(0, snippetLen);
                
                // Find start subtitle
                let matchIdx = -1;
                
                // 1. Try exact match of first few chars in clean text
                matchIdx = state.asrSubtitles.findIndex(s => {
                    const cleanSub = s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                    return cleanSub.includes(searchStr);
                });
                
                // 2. Fuzzy fallback: sliding window across ALL subtitles joined together
                if (matchIdx === -1) {
                    // Try to match in a window of 3 sentences to handle boundary splits
                    for (let i = 0; i < state.asrSubtitles.length; i++) {
                         let combined = state.asrSubtitles[i].text;
                         if (i + 1 < state.asrSubtitles.length) combined += state.asrSubtitles[i+1].text;
                         if (i + 2 < state.asrSubtitles.length) combined += state.asrSubtitles[i+2].text;
                         
                         const cleanCombined = combined.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                         
                         if (cleanCombined.includes(searchStr)) {
                             matchIdx = i;
                             break;
                         }
                    }
                }
                
                if (matchIdx !== -1) {
                    startT = state.asrSubtitles[matchIdx].start;
                    found = true;
                    
                    if (topic.end_snippet) {
                         const cleanEnd = topic.end_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").substring(0, 10);
                         // Search forward from start index
                         let endMatchIdx = -1;
                         
                         // Try exact match first
                         endMatchIdx = state.asrSubtitles.findIndex((s, idx) => idx > matchIdx && s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").includes(cleanEnd));
                         
                         // Fuzzy fallback for end time
                         if (endMatchIdx === -1) {
                             for (let i = matchIdx + 1; i < state.asrSubtitles.length; i++) {
                                 let combined = state.asrSubtitles[i].text;
                                 if (i + 1 < state.asrSubtitles.length) combined += state.asrSubtitles[i+1].text;
                                 if (i + 2 < state.asrSubtitles.length) combined += state.asrSubtitles[i+2].text;
                                 
                                 const cleanCombined = combined.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                                 if (cleanCombined.includes(cleanEnd)) {
                                     endMatchIdx = i;
                                     break;
                                 }
                             }
                         }

                         if (endMatchIdx !== -1) {
                             endT = state.asrSubtitles[endMatchIdx].end;
                         }
                    }
                }
            }
            
            // Render
            let timeInfo = "";
            if (found) {
                const timeStr = endT > startT ? `${formatTime(startT)}~${formatTime(endT)}` : `${formatTime(startT)}`;
                timeInfo = `<span style="color:var(--primary); font-size:0.85em; margin-left:8px;">[${timeStr}]</span>`;
                
                // Bind click
                li.style.cursor = "pointer";
                li.title = `点击跳转到 ${formatTime(startT)}`;
                li.addEventListener("click", () => {
                    const player = ui.asrVideoPlayer.style.display !== "none" ? ui.asrVideoPlayer : ui.asrAudioPlayer;
                    player.currentTime = startT;
                    player.play();
                });
            } else {
                 timeInfo = `<span style="color:var(--muted); font-size:0.85em; margin-left:8px;">[未匹配]</span>`;
            }

            li.innerHTML = `<span>${topic.title}</span>${timeInfo}`;
            ui.asrTopics.appendChild(li);
        });
        
        // Use persistent audio URL from server for current session
        if (file.type.startsWith("video") || file.name.endsWith(".mkv")) {
            ui.asrVideoPlayer.src = data.audio_url;
            ui.asrVideoPlayer.style.display = "block";
            ui.asrAudioPlayer.style.display = "none";
        } else {
            ui.asrAudioPlayer.src = data.audio_url;
            ui.asrAudioPlayer.style.display = "block";
            ui.asrVideoPlayer.style.display = "none";
        }
        
        ui.asrStatus.textContent = "转写完成！";
        
        // Save to history - use server's persistent audio URL
        const fileType = data.file_type || 'audio'; // Get file type from server response
        const historyRecord = {
            type: 'asr',
            filename: file.name,
            audioUrl: data.audio_url,  // Use persistent URL from server
            fileType: fileType,  // Save file type (video or audio)
            transcript: data.transcript,
            subtitles: data.subtitles || [],
            keywords: data.keywords || [],
            summary: data.summary || "",
            topics: data.topics || [],
            analysis: data.analysis || null
        };
        HistoryManager.saveHistory(historyRecord);
        
    } catch (e) {
        ui.asrStatus.textContent = "错误: " + e.message;
        asrTracker.stop();
        hideProgress('asr');
    } finally {
        ui.startAsr.disabled = false;
        ui.startAsr.textContent = "开始转写";
    }
}

ui.startAsr.addEventListener("click", startAsr);

// --- ASR from URL ---
async function startAsrUrl() {
    const url = (ui.asrUrl.value ?? "").trim();
    const dashscopeKey = ui.dashscopeKey.value.trim();
    
    if (!url) {
        alert("请输入视频网址");
        return;
    }
    if (!dashscopeKey) {
        alert("请先配置 API Key。");
        return;
    }

    ui.startAsrUrl.disabled = true;
    ui.startAsr.textContent = "转写中...";
    ui.startAsrUrl.textContent = "正在下载并转写...";
    ui.asrStatus.textContent = "正在从URL下载音视频并进行转写 (Qwen3-Omni-Flash)...";
    ui.asrResultSection.classList.add("hidden");

    // Show progress bar
    updateProgress('asr', 5, "正在下载文件...");
    
    // 创建ASR进度追踪器
    const asrTracker = window.ProgressTracker.createASRTracker({
    estimatedDuration: 120000, // URL转写预估2分钟
    onProgress: (progress, status) => {
      updateProgress('asr', progress, status);
    },
    onComplete: (success, result) => {
      console.log('ASR URL tracking completed:', result);
      if (result.usingFallback) {
        console.log('ASR URL used fallback estimation mode');
      }
    }
  });
  
  asrTracker.start();

    try {
        const res = await fetch("/api/asr-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, dashscopeKey })
        });

        const data = await res.json();

        if (!data.ok) {
          asrTracker.stop();
          throw new Error(data.error || "转写失败");
        }
        
        // 停止进度追踪
        asrTracker.stop();
        
        // Update progress to show completion
        updateProgress('asr', 100, "转写完成！");

        // Hide progress bar after a short delay
        setTimeout(() => hideProgress('asr'), 1500);

        if (!data.ok) {
            throw new Error(data.error || "转写失败");
        }

        ui.asrResultSection.classList.remove("hidden");
        ui.asrText.value = data.transcript;

        state.asrSubtitles = data.subtitles || [];
        renderAsrInteractive();
        ui.showAsrInteractive.click();

        ui.asrKeywords.innerHTML = "";
        (data.keywords || []).forEach(kw => {
            const tag = document.createElement("span");
            tag.className = "keyword-tag";
            tag.textContent = kw;
            tag.style.marginRight = "8px";
            ui.asrKeywords.appendChild(tag);
        });

        ui.asrSummary.textContent = data.summary || "（无摘要）";

        // Topics
        ui.asrTopics.innerHTML = "";

        const formatTime = (seconds) => {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}分${s}秒`;
        };

        (data.topics || []).forEach(topic => {
            const li = document.createElement("li");
            li.className = "topic-item";

            let startT = 0, endT = 0;
            let found = false;

            if (topic.start_snippet && state.asrSubtitles.length > 0) {
                const cleanSnippet = topic.start_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                const snippetLen = Math.min(cleanSnippet.length, 15);
                const searchStr = cleanSnippet.substring(0, snippetLen);

                let matchIdx = -1;

                matchIdx = state.asrSubtitles.findIndex(s => {
                    const cleanSub = s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                    return cleanSub.includes(searchStr);
                });

                if (matchIdx === -1) {
                    for (let i = 0; i < state.asrSubtitles.length; i++) {
                        let combined = state.asrSubtitles[i].text;
                        if (i + 1 < state.asrSubtitles.length) combined += state.asrSubtitles[i + 1].text;
                        if (i + 2 < state.asrSubtitles.length) combined += state.asrSubtitles[i + 2].text;

                        const cleanCombined = combined.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");

                        if (cleanCombined.includes(searchStr)) {
                            matchIdx = i;
                            break;
                        }
                    }
                }

                if (matchIdx !== -1) {
                    startT = state.asrSubtitles[matchIdx].start;
                    found = true;

                    if (topic.end_snippet) {
                        const cleanEnd = topic.end_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").substring(0, 10);
                        let endMatchIdx = -1;

                        endMatchIdx = state.asrSubtitles.findIndex((s, idx) => idx > matchIdx && s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").includes(cleanEnd));

                        if (endMatchIdx === -1) {
                            for (let i = matchIdx + 1; i < state.asrSubtitles.length; i++) {
                                let combined = state.asrSubtitles[i].text;
                                if (i + 1 < state.asrSubtitles.length) combined += state.asrSubtitles[i + 1].text;
                                if (i + 2 < state.asrSubtitles.length) combined += state.asrSubtitles[i + 2].text;

                                const cleanCombined = combined.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
                                if (cleanCombined.includes(cleanEnd)) {
                                    endMatchIdx = i;
                                    break;
                                }
                            }
                        }

                        if (endMatchIdx !== -1) {
                            endT = state.asrSubtitles[endMatchIdx].end;
                        }
                    }
                }
            }

            let timeInfo = "";
            if (found) {
                const timeStr = endT > startT ? `${formatTime(startT)}~${formatTime(endT)}` : `${formatTime(startT)}`;
                timeInfo = `<span style="color:var(--primary); font-size:0.85em; margin-left:8px;">[${timeStr}]</span>`;

                li.style.cursor = "pointer";
                li.title = `点击跳转到 ${formatTime(startT)}`;
                li.addEventListener("click", () => {
                    const player = ui.asrVideoPlayer.style.display !== "none" ? ui.asrVideoPlayer : ui.asrAudioPlayer;
                    player.currentTime = startT;
                    player.play();
                });
            } else {
                timeInfo = `<span style="color:var(--muted); font-size:0.85em; margin-left:8px;">[未匹配]</span>`;
            }

            li.innerHTML = `<span>${topic.title}</span>${timeInfo}`;
            ui.asrTopics.appendChild(li);
        });

        // Use appropriate player based on file type
        const fileType = data.file_type || 'audio';
        if (fileType === 'video') {
            ui.asrVideoPlayer.src = data.audio_url;
            ui.asrVideoPlayer.style.display = "block";
            ui.asrAudioPlayer.style.display = "none";
        } else {
            ui.asrAudioPlayer.src = data.audio_url;
            ui.asrAudioPlayer.style.display = "block";
            ui.asrVideoPlayer.style.display = "none";
        }

        ui.asrStatus.textContent = "转写完成！";

        // Save to history
        const historyRecord = {
            type: 'asr',
            filename: data.source_url || url, // Use original URL as filename
            audioUrl: data.audio_url,
            fileType: fileType,
            transcript: data.transcript,
            subtitles: data.subtitles || [],
            keywords: data.keywords || [],
            summary: data.summary || "",
            topics: data.topics || [],
            analysis: data.analysis || null,
            source_url: data.source_url // Track the original URL
        };
        HistoryManager.saveHistory(historyRecord);

    } catch (e) {
        ui.asrStatus.textContent = "错误: " + e.message;
        asrTracker.stop();
        hideProgress('asr');
    } finally {
        ui.startAsrUrl.disabled = false;
        ui.startAsr.textContent = "开始转写";
        ui.startAsrUrl.textContent = "从URL转写";
    }
}

ui.startAsrUrl.addEventListener("click", startAsrUrl);

function renderAsrInteractive() {
    ui.asrInteractive.innerHTML = "";
    state.asrSubtitles.forEach((sub, idx) => {
        const span = document.createElement("span");
        span.textContent = sub.text; 
        span.className = "word-span";
        span.dataset.idx = idx;
        span.dataset.start = sub.start;
        span.dataset.end = sub.end;
        ui.asrInteractive.appendChild(span);
    });
}

function updateAsrHighlight(time) {
    if (!state.asrSubtitles.length) return;
    const activeIdx = state.asrSubtitles.findIndex(s => time >= s.start && time <= s.end);
    
    const currentActive = ui.asrInteractive.querySelector(".word-span.active");
    if (currentActive && currentActive.dataset.idx != activeIdx) {
        currentActive.classList.remove("active");
    }
    
    if (activeIdx !== -1) {
        const target = ui.asrInteractive.querySelector(`.word-span[data-idx="${activeIdx}"]`);
        if (target) {
            target.classList.add("active");
            if (target.offsetTop > ui.asrInteractive.scrollTop + ui.asrInteractive.clientHeight - 50 || 
                target.offsetTop < ui.asrInteractive.scrollTop) {
                target.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }
}

[ui.asrAudioPlayer, ui.asrVideoPlayer].forEach(p => {
    p.addEventListener("timeupdate", () => {
        if (p.style.display !== "none") updateAsrHighlight(p.currentTime);
    });
});

ui.asrInteractive.addEventListener("click", (e) => {
    const target = e.target.closest(".word-span");
    if (!target) return;
    const start = parseFloat(target.dataset.start);
    if (!isNaN(start)) {
        const player = ui.asrVideoPlayer.style.display !== "none" ? ui.asrVideoPlayer : ui.asrAudioPlayer;
        player.currentTime = start;
        player.play();
    }
});

ui.showAsrInteractive.addEventListener("click", () => {
    ui.asrInteractive.classList.remove("hidden");
    ui.asrText.classList.add("hidden");
    ui.showAsrInteractive.classList.add("primary");
    ui.showAsrEditable.classList.remove("primary");
});

ui.showAsrEditable.addEventListener("click", () => {
    ui.asrInteractive.classList.add("hidden");
    ui.asrText.classList.remove("hidden");
    ui.showAsrInteractive.classList.remove("primary");
    ui.showAsrEditable.classList.add("primary");
});

// --- OCR ---

let ocrFileQueue = [];

function renderOcrFileList() {
    if (ocrFileQueue.length === 0) {
        ui.ocrFileList.innerHTML = "(暂无文件，请点击“添加文件”按钮)";
        return;
    }
    
    ui.ocrFileList.innerHTML = "";
    ocrFileQueue.forEach((file, idx) => {
        const div = document.createElement("div");
        div.style.padding = "4px 8px";
        div.style.borderBottom = "1px solid var(--border)";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        
        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${idx + 1}. ${file.name}`;
        
        // Remove button for individual file? Maybe overkill for now.
        // Let's just show list.
        
        div.appendChild(nameSpan);
        ui.ocrFileList.appendChild(div);
    });
}

ui.ocrFile.addEventListener("change", () => {
    const files = Array.from(ui.ocrFile.files);
    if (files.length === 0) return;
    
    // Check total limit
    if (ocrFileQueue.length + files.length > 10) {
        alert(`最多只能添加 10 个文件。当前已添加 ${ocrFileQueue.length} 个，尝试添加 ${files.length} 个。`);
        return;
    }
    
    // Filter out large files (> 4MB)
    const validFiles = [];
    const tooLargeFiles = [];
    
    files.forEach(f => {
        if (f.size > 4 * 1024 * 1024) { // 4MB
            tooLargeFiles.push(f.name);
        } else {
            validFiles.push(f);
        }
    });
    
    if (tooLargeFiles.length > 0) {
        alert(`以下文件超过 4MB 限制，无法添加（请压缩后重试）：\n${tooLargeFiles.join("\n")}`);
    }
    
    if (validFiles.length > 0) {
        // Append
        ocrFileQueue = ocrFileQueue.concat(validFiles);
        renderOcrFileList();
    }
    
    // Reset input so same file can be added again if really needed (or just to allow change event)
    ui.ocrFile.value = "";
});

ui.clearOcrFiles.addEventListener("click", () => {
    ocrFileQueue = [];
    renderOcrFileList();
    ui.ocrFile.value = "";
});

async function startOcr() {
  const dashscopeKey = ui.dashscopeKey.value.trim();
  
  if (ocrFileQueue.length === 0) { alert("请至少添加一个文件"); return; }
  if (!dashscopeKey) { alert("请先配置 Alibaba DashScope Key。"); return; }
  
  ui.startOcr.disabled = true;
  ui.startOcr.textContent = `正在转换 ${ocrFileQueue.length} 个文件...`;
  ui.ocrResult.classList.add("hidden");
  
  const form = new FormData();
  // Append in order of queue
  for (let i = 0; i < ocrFileQueue.length; i++) {
      form.append("file", ocrFileQueue[i]);
  }
  form.append("dashscopeKey", dashscopeKey);
  
  try {
      const res = await fetch("/api/ocr-to-word", { method: "POST", body: form });
      
      // Check for non-JSON response (e.g. 413 Payload Too Large)
      if (!res.ok) {
          if (res.status === 413) {
              throw new Error("文件总大小超过服务器限制 (4.5MB)。请分批转换或压缩图片。");
          }
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
             const errData = await res.json();
             throw new Error(errData.error || `HTTP ${res.status}`);
          } else {
             const text = await res.text();
             // Try to extract useful info or just return status
             throw new Error(`HTTP ${res.status}: ${text.substring(0, 100)}...`);
          }
      }

      const data = await res.json();
      if (data.ok) {
          ui.ocrResult.classList.remove("hidden");
          ui.ocrResultText.value = data.text;
          ui.ocrStatus.textContent = "识别成功！请检查并编辑结果，然后点击保存生成 Word。";
      } else {
          ui.ocrStatus.textContent = "错误: " + data.error;
      }
  } catch (e) {
      if (e.message.includes("Unexpected token")) {
          ui.ocrStatus.textContent = "错误: 服务器返回了无效数据 (可能是文件过大导致超时或内存溢出)";
      } else {
          ui.ocrStatus.textContent = "错误: " + e.message;
      }
  } finally {
      ui.startOcr.disabled = false;
      ui.startOcr.textContent = "开始转换";
  }
}

ui.startOcr.addEventListener("click", startOcr);

async function generateWord() {
    const text = ui.ocrResultText.value;
    if (!text) {
        alert("没有可保存的内容。");
        return;
    }
    
    ui.generateWord.disabled = true;
    ui.generateWord.textContent = "生成中...";
    
    try {
        const res = await fetch("/api/generate-word", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        if (data.ok) {
            const link = document.createElement('a');
            link.href = data.download_url;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            ui.ocrStatus.textContent = "Word 文档生成成功！";
        } else {
            alert("生成失败: " + data.error);
        }
    } catch (e) {
        alert("请求失败: " + e.message);
    } finally {
        ui.generateWord.disabled = false;
        ui.generateWord.textContent = "保存并生成 Word 文档";
    }
}

let currentAdviceData = null;

async function getAiAdvice() {
    const text = ui.ocrResultText.value;
    if (!text) {
        alert("请先进行 OCR 识别或输入文字。");
        return;
    }
    
    const dashscopeKey = ui.dashscopeKey?.value;
    const customPrompt = ui.customPrompt?.value?.trim();
    
    ui.getAiAdvice.disabled = true;
    if (ui.submitCustomPrompt) ui.submitCustomPrompt.disabled = true;

    ui.getAiAdvice.textContent = "正在分析...";
    ui.adviceSection.classList.add("hidden");
    
    try {
        const res = await fetch("/api/ai-advice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, dashscopeKey, custom_prompt: customPrompt })
        });
        
        const data = await res.json();
        if (data.ok && data.data) {
            currentAdviceData = data.data;
            ui.adviceSection.classList.remove("hidden");
            
            // Check if this is a custom format response (not the standard 5-section format)
            const isCustomFormat = customPrompt && currentAdviceData.custom_format === true;
            
            if (isCustomFormat) {
                // Handle custom format - just display the analysis as-is
                ui.adviceAnalysis.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.6;">${currentAdviceData.analysis || "无分析内容"}</div>`;
                ui.adviceList.innerHTML = "";
            } else if (customPrompt) {
                // Custom prompt was used but AI returned standard format - show it with a note
                ui.adviceAnalysis.innerHTML = `<div style="background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin-bottom: 16px;">
                    <strong>注意：</strong>AI按照标准格式返回了分析结果。以下是详细分析：
                </div>` + (currentAdviceData.analysis || "无总体评价");
                
                // Continue with standard format rendering...
                ui.adviceList.innerHTML = "";
                
                // 2. Structure Advice
                if (currentAdviceData.structure_advice) {
                    const structDiv = document.createElement('div');
                    structDiv.style.margin = "16px 0";
                    structDiv.style.padding = "12px";
                    structDiv.style.background = "#f0f9ff";
                    structDiv.style.borderLeft = "4px solid #0ea5e9";
                    structDiv.innerHTML = `<h4 style="margin:0 0 8px 0;">🏗️ 写作思路与结构进阶</h4>
                                           <div style="font-size:0.95em; white-space: pre-wrap;">${currentAdviceData.structure_advice}</div>`;
                    ui.adviceList.appendChild(structDiv);
                }
                
                // 3. Alternative Ideas
                if (currentAdviceData.alternative_ideas && currentAdviceData.alternative_ideas.length > 0) {
                    const ideaDiv = document.createElement('div');
                    ideaDiv.style.margin = "16px 0";
                    ideaDiv.style.padding = "12px";
                    ideaDiv.style.background = "#fff7ed";
                    ideaDiv.style.borderLeft = "4px solid #f97316";
                    
                    let ideaHtml = `<h4 style="margin:0 0 12px 0; color:#c2410c;">💡 多维审题与构思拓展</h4>`;
                    currentAdviceData.alternative_ideas.forEach(idea => {
                        ideaHtml += `<div style="margin-bottom:8px;">
                                        <div style="font-weight:bold; color:#ea580c;">${idea.title}</div>
                                        <div style="font-size:0.95em; color:#431407;">${idea.desc}</div>
                                     </div>`;
                    });
                    ideaDiv.innerHTML = ideaHtml;
                    ui.adviceList.appendChild(ideaDiv);
                }
                
                // 4. Detailed Suggestions
                if (currentAdviceData.suggestions && currentAdviceData.suggestions.length > 0) {
                    const listHeader = document.createElement('h4');
                    listHeader.textContent = "✍️ 细节润色与手法升级";
                    listHeader.style.margin = "20px 0 8px 0";
                    ui.adviceList.appendChild(listHeader);

                    currentAdviceData.suggestions.forEach((item, idx) => {
                        const div = document.createElement("div");
                        div.style.marginBottom = "16px";
                        div.style.padding = "12px";
                        div.style.border = "1px solid var(--border)";
                        div.style.borderRadius = "6px";
                        div.style.background = "var(--bg)";
                        
                        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                        <strong>建议 ${idx+1}</strong>
                                        <span style="font-size:0.85em; background:var(--bg-muted); padding:2px 6px; border-radius:4px; color:var(--primary);">${item.technique || "润色建议"}</span>
                                    </div>`;
                        
                        if (item.original) {
                            html += `<div style="color:var(--muted); font-size:0.9em; margin-bottom:6px; padding-left:8px; border-left:2px solid #ccc;">
                                        原文：${item.original}
                                     </div>`;
                        }
                        
                        html += `<div style="margin-bottom:8px; font-size:0.95em;">
                                    <strong>分析：</strong>${item.suggestion}
                                 </div>`;
                                 
                        if (item.refined_text) {
                            const highlighted = item.refined_text.replace(/\*\*(.*?)\*\*/g, '<span style="color:#d9534f; font-weight:bold;">$1</span>');
                            html += `<div style="background:#fff1f0; padding:8px; border-radius:4px; border-left:3px solid #d9534f;">
                                        <strong>🚀 升格示例：</strong>${highlighted}
                                     </div>`;
                        }
                        
                        div.innerHTML = html;
                        ui.adviceList.appendChild(div);
                    });
                }
                
                // 5. Style Demonstrations
                if (currentAdviceData.style_demonstrations && currentAdviceData.style_demonstrations.length > 0) {
                    const styleHeader = document.createElement('h4');
                    styleHeader.textContent = "🎨 三种风格润色示范 (每种风格 3 例)";
                    styleHeader.style.margin = "24px 0 12px 0";
                    ui.adviceList.appendChild(styleHeader);

                    currentAdviceData.style_demonstrations.forEach(demo => {
                        const card = document.createElement('div');
                        card.style.marginBottom = "24px";
                        card.style.padding = "16px";
                        card.style.borderRadius = "8px";
                        card.style.background = "#fff";
                        card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                        card.style.border = "1px solid #e5e7eb";

                        // Style Title Color
                        let titleColor = "#333";
                        let badgeColor = "#e5e7eb";
                        if (demo.style_name.includes("中考")) { titleColor = "#16a34a"; badgeColor = "#dcfce7"; } 
                        else if (demo.style_name.includes("散文")) { titleColor = "#9333ea"; badgeColor = "#f3e8ff"; }
                        else if (demo.style_name.includes("思辨")) { titleColor = "#2563eb"; badgeColor = "#dbeafe"; }

                        let html = `<div style="display:flex; align-items:center; margin-bottom:12px; border-bottom: 2px solid ${badgeColor}; padding-bottom: 8px;">
                                        <div style="font-weight:bold; font-size:1.2em; color:${titleColor};">${demo.style_name}</div>
                                    </div>`;
                        
                        const examples = demo.examples || [];
                        if (examples.length === 0 && demo.refined_text) {
                            examples.push({
                                original_snippet: demo.original_snippet,
                                refined_text: demo.refined_text,
                                comment: demo.comment
                            });
                        }

                        examples.forEach((ex, i) => {
                            html += `<div style="margin-bottom: 16px;">
                                        <div style="font-size:0.9em; font-weight:bold; color:#555; margin-bottom:4px;">示例 ${i+1}</div>`;
                            
                            if (ex.original_snippet) {
                                html += `<div style="font-size:0.9em; color:#666; margin-bottom:6px; font-style:italic; padding-left: 8px; border-left: 2px solid #ccc;">
                                            原文：“${ex.original_snippet}”
                                         </div>`;
                            }
                            
                            html += `<div style="font-size:1em; line-height:1.6; color:#1f2937; margin-bottom:6px; padding:10px; background:${badgeColor}; border-radius:6px;">
                                        ${ex.refined_text}
                                     </div>`;
                            
                            if (ex.comment) {
                                html += `<div style="font-size:0.85em; color:#6b7280;">
                                            <span style="font-weight:bold;">解析：</span>${ex.comment}
                                         </div>`;
                            }
                            html += `</div>`;
                        });
                        
                        card.innerHTML = html;
                        ui.adviceList.appendChild(card);
                    });
                }
            } else {
                // Standard format without custom prompt
                // 1. Score & Analysis
                const scoreHtml = currentAdviceData.score_prediction 
                    ? `<div style="font-size: 1.2em; font-weight: bold; color: var(--primary); margin-bottom: 8px;">${currentAdviceData.score_prediction}</div>` 
                    : '';
                ui.adviceAnalysis.innerHTML = scoreHtml + (currentAdviceData.analysis || "无总体评价");
                
                // Rest of the standard format rendering...
                ui.adviceList.innerHTML = "";
                
                // 2. Structure Advice
                if (currentAdviceData.structure_advice) {
                    const structDiv = document.createElement('div');
                    structDiv.style.margin = "16px 0";
                    structDiv.style.padding = "12px";
                    structDiv.style.background = "#f0f9ff";
                    structDiv.style.borderLeft = "4px solid #0ea5e9";
                    structDiv.innerHTML = `<h4 style="margin:0 0 8px 0;">🏗️ 写作思路与结构进阶</h4>
                                           <div style="font-size:0.95em; white-space: pre-wrap;">${currentAdviceData.structure_advice}</div>`;
                    ui.adviceList.appendChild(structDiv);
                }
                
                // 3. Alternative Ideas
                if (currentAdviceData.alternative_ideas && currentAdviceData.alternative_ideas.length > 0) {
                    const ideaDiv = document.createElement('div');
                    ideaDiv.style.margin = "16px 0";
                    ideaDiv.style.padding = "12px";
                    ideaDiv.style.background = "#fff7ed";
                    ideaDiv.style.borderLeft = "4px solid #f97316";
                    
                    let ideaHtml = `<h4 style="margin:0 0 12px 0; color:#c2410c;">💡 多维审题与构思拓展</h4>`;
                    currentAdviceData.alternative_ideas.forEach(idea => {
                        ideaHtml += `<div style="margin-bottom:8px;">
                                        <div style="font-weight:bold; color:#ea580c;">${idea.title}</div>
                                        <div style="font-size:0.95em; color:#431407;">${idea.desc}</div>
                                     </div>`;
                    });
                    ideaDiv.innerHTML = ideaHtml;
                    ui.adviceList.appendChild(ideaDiv);
                }
                
                // 4. Detailed Suggestions
                if (currentAdviceData.suggestions && currentAdviceData.suggestions.length > 0) {
                    const listHeader = document.createElement('h4');
                    listHeader.textContent = "✍️ 细节润色与手法升级";
                    listHeader.style.margin = "20px 0 8px 0";
                    ui.adviceList.appendChild(listHeader);

                    currentAdviceData.suggestions.forEach((item, idx) => {
                        const div = document.createElement("div");
                        div.style.marginBottom = "16px";
                        div.style.padding = "12px";
                        div.style.border = "1px solid var(--border)";
                        div.style.borderRadius = "6px";
                        div.style.background = "var(--bg)";
                        
                        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                        <strong>建议 ${idx+1}</strong>
                                        <span style="font-size:0.85em; background:var(--bg-muted); padding:2px 6px; border-radius:4px; color:var(--primary);">${item.technique || "润色建议"}</span>
                                    </div>`;
                        
                        if (item.original) {
                            html += `<div style="color:var(--muted); font-size:0.9em; margin-bottom:6px; padding-left:8px; border-left:2px solid #ccc;">
                                        原文：${item.original}
                                     </div>`;
                        }
                        
                        html += `<div style="margin-bottom:8px; font-size:0.95em;">
                                    <strong>分析：</strong>${item.suggestion}
                                 </div>`;
                                 
                        if (item.refined_text) {
                            const highlighted = item.refined_text.replace(/\*\*(.*?)\*\*/g, '<span style="color:#d9534f; font-weight:bold;">$1</span>');
                            html += `<div style="background:#fff1f0; padding:8px; border-radius:4px; border-left:3px solid #d9534f;">
                                        <strong>🚀 升格示例：</strong>${highlighted}
                                     </div>`;
                        }
                        
                        div.innerHTML = html;
                        ui.adviceList.appendChild(div);
                    });
                }
                
                // 5. Style Demonstrations
                if (currentAdviceData.style_demonstrations && currentAdviceData.style_demonstrations.length > 0) {
                    const styleHeader = document.createElement('h4');
                    styleHeader.textContent = "🎨 三种风格润色示范 (每种风格 3 例)";
                    styleHeader.style.margin = "24px 0 12px 0";
                    ui.adviceList.appendChild(styleHeader);

                    currentAdviceData.style_demonstrations.forEach(demo => {
                        const card = document.createElement('div');
                        card.style.marginBottom = "24px";
                        card.style.padding = "16px";
                        card.style.borderRadius = "8px";
                        card.style.background = "#fff";
                        card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                        card.style.border = "1px solid #e5e7eb";

                        // Style Title Color
                        let titleColor = "#333";
                        let badgeColor = "#e5e7eb";
                        if (demo.style_name.includes("中考")) { titleColor = "#16a34a"; badgeColor = "#dcfce7"; } 
                        else if (demo.style_name.includes("散文")) { titleColor = "#9333ea"; badgeColor = "#f3e8ff"; }
                        else if (demo.style_name.includes("思辨")) { titleColor = "#2563eb"; badgeColor = "#dbeafe"; }

                        let html = `<div style="display:flex; align-items:center; margin-bottom:12px; border-bottom: 2px solid ${badgeColor}; padding-bottom: 8px;">
                                        <div style="font-weight:bold; font-size:1.2em; color:${titleColor};">${demo.style_name}</div>
                                    </div>`;
                        
                        const examples = demo.examples || [];
                        if (examples.length === 0 && demo.refined_text) {
                            examples.push({
                                original_snippet: demo.original_snippet,
                                refined_text: demo.refined_text,
                                comment: demo.comment
                            });
                        }

                        examples.forEach((ex, i) => {
                            html += `<div style="margin-bottom: 16px;">
                                        <div style="font-size:0.9em; font-weight:bold; color:#555; margin-bottom:4px;">示例 ${i+1}</div>`;
                            
                            if (ex.original_snippet) {
                                html += `<div style="font-size:0.9em; color:#666; margin-bottom:6px; font-style:italic; padding-left: 8px; border-left: 2px solid #ccc;">
                                            原文：“${ex.original_snippet}”
                                         </div>`;
                            }
                            
                            html += `<div style="font-size:1em; line-height:1.6; color:#1f2937; margin-bottom:6px; padding:10px; background:${badgeColor}; border-radius:6px;">
                                        ${ex.refined_text}
                                     </div>`;
                            
                            if (ex.comment) {
                                html += `<div style="font-size:0.85em; color:#6b7280;">
                                            <span style="font-weight:bold;">解析：</span>${ex.comment}
                                         </div>`;
                            }
                            html += `</div>`;
                        });
                        
                        card.innerHTML = html;
                        ui.adviceList.appendChild(card);
                    });
                }
            }
            
            // Scroll to advice
            ui.adviceSection.scrollIntoView({ behavior: "smooth" });

            // 4. Detailed Suggestions
            const listHeader = document.createElement('h4');
            listHeader.textContent = "✍️ 细节润色与手法升级";
            listHeader.style.margin = "20px 0 8px 0";
            ui.adviceList.appendChild(listHeader);

            (currentAdviceData.suggestions || []).forEach((item, idx) => {
                const div = document.createElement("div");
                div.style.marginBottom = "16px";
                div.style.padding = "12px";
                div.style.border = "1px solid var(--border)";
                div.style.borderRadius = "6px";
                div.style.background = "var(--bg)";
                
                let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <strong>建议 ${idx+1}</strong>
                                <span style="font-size:0.85em; background:var(--bg-muted); padding:2px 6px; border-radius:4px; color:var(--primary);">${item.technique || "润色建议"}</span>
                            </div>`;
                
                if (item.original) {
                    html += `<div style="color:var(--muted); font-size:0.9em; margin-bottom:6px; padding-left:8px; border-left:2px solid #ccc;">
                                原文：${item.original}
                             </div>`;
                }
                
                html += `<div style="margin-bottom:8px; font-size:0.95em;">
                            <strong>分析：</strong>${item.suggestion}
                         </div>`;
                         
                // Highlighted refined text
                if (item.refined_text) {
                    const highlighted = item.refined_text.replace(/\*\*(.*?)\*\*/g, '<span style="color:#d9534f; font-weight:bold;">$1</span>');
                    html += `<div style="background:#fff1f0; padding:8px; border-radius:4px; border-left:3px solid #d9534f;">
                                <strong>🚀 升格示例：</strong>${highlighted}
                             </div>`;
                } else if (item.suggestion && !item.refined_text) {
                     // Fallback for old format
                     const highlighted = item.suggestion.replace(/\*\*(.*?)\*\*/g, '<span style="color:#d9534f; font-weight:bold;">$1</span>');
                    html += `<div>建议：${highlighted}</div>`;
                }
                
                div.innerHTML = html;
                ui.adviceList.appendChild(div);
            });

            // 5. Style Demonstrations
            const styleHeader = document.createElement('h4');
            styleHeader.textContent = "🎨 三种风格润色示范 (每种风格 3 例)";
            styleHeader.style.margin = "24px 0 12px 0";
            ui.adviceList.appendChild(styleHeader);

            (currentAdviceData.style_demonstrations || []).forEach(demo => {
                const card = document.createElement('div');
                card.style.marginBottom = "24px";
                card.style.padding = "16px";
                card.style.borderRadius = "8px";
                card.style.background = "#fff";
                card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                card.style.border = "1px solid #e5e7eb";

                // Style Title Color
                let titleColor = "#333";
                let badgeColor = "#e5e7eb";
                if (demo.style_name.includes("中考")) { titleColor = "#16a34a"; badgeColor = "#dcfce7"; } 
                else if (demo.style_name.includes("散文")) { titleColor = "#9333ea"; badgeColor = "#f3e8ff"; }
                else if (demo.style_name.includes("思辨")) { titleColor = "#2563eb"; badgeColor = "#dbeafe"; }

                let html = `<div style="display:flex; align-items:center; margin-bottom:12px; border-bottom: 2px solid ${badgeColor}; padding-bottom: 8px;">
                                <div style="font-weight:bold; font-size:1.2em; color:${titleColor};">${demo.style_name}</div>
                            </div>`;
                
                // Iterate through examples
                const examples = demo.examples || [];
                if (examples.length === 0 && demo.refined_text) {
                     // Fallback for old structure if LLM returns old format
                     examples.push({
                         original_snippet: demo.original_snippet,
                         refined_text: demo.refined_text,
                         comment: demo.comment
                     });
                }

                examples.forEach((ex, i) => {
                    html += `<div style="margin-bottom: 16px;">
                                <div style="font-size:0.9em; font-weight:bold; color:#555; margin-bottom:4px;">示例 ${i+1}</div>`;
                    
                    if (ex.original_snippet) {
                        html += `<div style="font-size:0.9em; color:#666; margin-bottom:6px; font-style:italic; padding-left: 8px; border-left: 2px solid #ccc;">
                                    原文：“${ex.original_snippet}”
                                 </div>`;
                    }
                    
                    html += `<div style="font-size:1em; line-height:1.6; color:#1f2937; margin-bottom:6px; padding:10px; background:${badgeColor}; border-radius:6px;">
                                ${ex.refined_text}
                             </div>`;
                    
                    if (ex.comment) {
                        html += `<div style="font-size:0.85em; color:#6b7280;">
                                    <span style="font-weight:bold;">解析：</span>${ex.comment}
                                 </div>`;
                    }
                    html += `</div>`;
                });
                
                card.innerHTML = html;
                ui.adviceList.appendChild(card);
            });
            
            // Scroll to advice
            ui.adviceSection.scrollIntoView({ behavior: "smooth" });
            
        } else {
            alert("获取建议失败: " + (data.error || "未知错误"));
        }
    } catch (e) {
        alert("请求出错: " + e.message);
    } finally {
        ui.getAiAdvice.disabled = false;
        if (ui.submitCustomPrompt) ui.submitCustomPrompt.disabled = false;
        ui.getAiAdvice.textContent = "AI 建议 (作文润色)";
    }
}

async function exportAdvice() {
    if (!currentAdviceData) return;
    
    const original_text = ui.ocrResultText.value;
    ui.exportAdvice.disabled = true;
    ui.exportAdvice.textContent = "导出中...";
    
    try {
        const res = await fetch("/api/generate-advice-word", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                original_text,
                advice_data: currentAdviceData
            })
        });
        
        const data = await res.json();
        if (data.ok) {
            const link = document.createElement('a');
            link.href = data.download_url;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert("导出失败: " + data.error);
        }
    } catch (e) {
        alert("导出出错: " + e.message);
    } finally {
        ui.exportAdvice.disabled = false;
        ui.exportAdvice.textContent = "导出建议为 Word";
    }
}

ui.getAiAdvice.addEventListener("click", getAiAdvice);
if (ui.submitCustomPrompt) {
    ui.submitCustomPrompt.addEventListener("click", getAiAdvice);
}

// Default custom prompt buttons
if (ui.defaultPrompt1) {
    ui.defaultPrompt1.addEventListener("click", () => {
        const defaultPrompt = "以中考阅卷专家组的视角，来评价这名预初学生的作文内容。既要对写的好的地方，无论是用词用句还是行文结构，都可以提出表扬。或者列出作文中最大的top5的加分项。于此同时也给出全文最大的top5减分项和不足。在针对top5的减分项给出具体的修改建议。";
        ui.customPrompt.value = defaultPrompt;
        // Auto-trigger the analysis
        getAiAdvice();
    });
}

if (ui.defaultPrompt2) {
    ui.defaultPrompt2.addEventListener("click", () => {
        const defaultPrompt = "请重点分析这篇作文的结构安排，包括开头结尾的设计、段落之间的过渡、情节发展的逻辑性，并给出具体的结构优化建议。";
        ui.customPrompt.value = defaultPrompt;
        getAiAdvice();
    });
}

if (ui.defaultPrompt3) {
    ui.defaultPrompt3.addEventListener("click", () => {
        const defaultPrompt = "请重点对这篇作文进行语言润色，包括词语选择、句式变化、修辞手法等方面，提供具体的修改建议和升格示例。";
        ui.customPrompt.value = defaultPrompt;
        getAiAdvice();
    });
}
ui.exportAdvice.addEventListener("click", exportAdvice);

ui.generateWord.addEventListener("click", generateWord);

// --- Import File ---
async function importPdfText() {
    const file = ui.pdfFile.files[0];
    const dashscopeKey = ui.dashscopeKey.value.trim();
    
    if (!file) return;
    if (!dashscopeKey) {
        alert("请先配置 Alibaba DashScope Key (用于智能标点修复)。");
        return;
    }
    
    ui.importPdf.disabled = true;
    ui.generateAudio.disabled = true; // Disable generation during processing
    ui.importPdf.textContent = "解析中...";
    const form = new FormData();
    form.append("file", file);
    
    try {
        // 1. Extract Text
        const res = await fetch("/api/extract-text", { method: "POST", body: form });
        const data = await res.json();
        if (data.ok) {
            let rawText = data.text;
            ui.text.value = rawText; 
            ui.text.placeholder = "正在进行智能标点修复和排版优化，请稍候...";
            // Visual feedback that text is pending finalization
            ui.text.style.opacity = "0.6"; 
            
            // 2. Fix Punctuation
            ui.importPdf.textContent = "智能修复排版中...";
            setStatus("正在使用 Qwen3-Max 进行智能标点修复和排版优化...");
            
            try {
                const fixedText = await fixPunctuationInternal(rawText, dashscopeKey);
                ui.text.value = fixedText;
                ui.text.style.opacity = "1";
                setStatus("导入并修复完成！现在可以生成语音了。");
            } catch (err) {
                console.error("Punctuation fix failed:", err);
                ui.text.style.opacity = "1";
                setStatus("标点修复失败，已保留原始内容。错误: " + err.message);
                alert("标点修复失败: " + err.message + "\n已保留原始内容。");
            }
            
        } else {
            alert("解析失败: " + data.error);
        }
    } catch (e) {
        alert("错误: " + e.message);
    } finally {
        ui.importPdf.disabled = false;
        ui.generateAudio.disabled = false; // Re-enable generation
        ui.importPdf.textContent = "导入文本 (自动修复标点)";
    }
}
ui.importPdf.addEventListener("click", importPdfText);

// --- Import URL ---
async function importUrlText() {
    const url = (ui.urlInput.value ?? "").trim();
    const dashscopeKey = ui.dashscopeKey.value.trim();

    if (!url) {
        alert("请输入网址。");
        return;
    }
    if (!dashscopeKey) {
        alert("请先配置 Alibaba DashScope Key。");
        return;
    }

    ui.importUrl.disabled = true;
    ui.importUrl.textContent = "提取中...";
    setStatus("正在从网址提取并排版...");

    try {
        const res = await fetch("/api/extract-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, dashscopeKey })
        });
        const data = await res.json();
        
        if (data.ok) {
            ui.text.value = data.text;
            setStatus("导入成功！");
        } else {
            alert("导入失败: " + data.error);
            setStatus("导入失败");
        }
    } catch (e) {
        alert("错误: " + e.message);
        setStatus("请求错误");
    } finally {
        ui.importUrl.disabled = false;
        ui.importUrl.textContent = "导入";
    }
}
ui.importUrl.addEventListener("click", importUrlText);

// --- Init ---
async function loadConfig() {
    try {
        const res = await fetch("/api/get-config");
        if (res.ok) {
            const data = await res.json();
            if (data.ok && data.dashscopeKey) {
                ui.dashscopeKey.value = data.dashscopeKey;
            }
        }
    } catch (e) {
        console.warn("Failed to load config:", e);
    }
}

// --- History Management ---

// History UI Elements
const historyUi = {
  btn: document.getElementById("historyBtn"),
  modal: document.getElementById("historyModal"),
  detailModal: document.getElementById("historyDetailModal"),
  closeBtn: document.getElementById("closeHistoryModal"),
  closeDetailBtn: document.getElementById("closeHistoryDetailModal"),
  list: document.getElementById("historyList"),
  empty: document.getElementById("historyEmpty"),
  detailTitle: document.getElementById("historyDetailTitle"),
  detailContent: document.getElementById("historyDetailContent")
};

// Open history modal
historyUi.btn.addEventListener("click", () => {
  historyUi.modal.classList.remove("hidden");
  renderHistoryList();
});

// Close history modal
historyUi.closeBtn.addEventListener("click", () => {
  historyUi.modal.classList.add("hidden");
});

// Close detail modal
historyUi.closeDetailBtn.addEventListener("click", () => {
  historyUi.detailModal.classList.add("hidden");
});

// Close modals on outside click
historyUi.modal.addEventListener("click", (e) => {
  if (e.target === historyUi.modal) {
    historyUi.modal.classList.add("hidden");
  }
});

historyUi.detailModal.addEventListener("click", (e) => {
  if (e.target === historyUi.detailModal) {
    historyUi.detailModal.classList.add("hidden");
  }
});

// Render history list
function renderHistoryList() {
  const history = HistoryManager.getAllHistory();
  
  if (history.length === 0) {
    historyUi.list.innerHTML = "";
    historyUi.empty.classList.remove("hidden");
    return;
  }
  
  historyUi.empty.classList.add("hidden");
  historyUi.list.innerHTML = "";
  
  history.forEach(record => {
    const item = document.createElement("div");
    item.className = "history-item";
    
    const typeLabel = HistoryManager.getTypeLabel(record.type);
    const dateLabel = HistoryManager.formatDate(record.createdAt);
    
    // Get keywords and summary based on record type
    let keywords = [];
    let summary = "";
    
    if (record.type === 'tts') {
      keywords = record.analysis?.keywords || [];
      summary = record.analysis?.summary || "";
    } else if (record.type === 'asr') {
      keywords = record.keywords || [];
      summary = record.summary || "";
    }
    
    // Get title based on record type
    let title = "";
    if (record.type === 'tts') {
      title = record.filename || "未命名音频";
    } else if (record.type === 'asr') {
      title = record.filename || "未命名音频";
    }
    
    // Build keywords HTML
    const keywordsHtml = keywords.length > 0 
      ? keywords.slice(0, 5).map(kw => `<span class="history-item-keyword">${kw}</span>`).join("")
      : "";
    
    // Build summary HTML
    const summaryHtml = summary 
      ? `<div class="history-item-summary">${summary}</div>`
      : `<div class="history-item-no-analysis">暂无分析结果</div>`;
    
    item.innerHTML = `
      <div class="history-item-header">
        <span class="history-item-type ${record.type}">${typeLabel}</span>
        <span class="history-item-date">${dateLabel}</span>
      </div>
      <div class="history-item-title">${title}</div>
      ${keywordsHtml ? `<div class="history-item-keywords">${keywordsHtml}</div>` : ""}
      ${summaryHtml}
      <div class="history-item-actions">
        <button class="history-btn-delete" data-id="${record.id}">删除</button>
      </div>
    `;
    
    // Click to view details
    item.addEventListener("click", (e) => {
      if (!e.target.classList.contains("history-btn-delete")) {
        openHistoryDetail(record);
      }
    });
    
    // Delete button
    const deleteBtn = item.querySelector(".history-btn-delete");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("确定要删除这条历史记录吗？")) {
        HistoryManager.deleteHistory(record.id);
        renderHistoryList();
      }
    });
    
    historyUi.list.appendChild(item);
  });
}

// Open history detail
function openHistoryDetail(record) {
  historyUi.detailModal.classList.remove("hidden");
  
  const typeLabel = HistoryManager.getTypeLabel(record.type);
  const dateLabel = HistoryManager.formatDate(record.createdAt);
  
  historyUi.detailTitle.textContent = `${typeLabel} - ${record.filename || "详情"}`;
  
  let content = "";
  
  if (record.type === 'tts') {
    content = renderTTSHistoryDetail(record);
  } else if (record.type === 'asr') {
    content = renderASRHistoryDetail(record);
  }
  
  historyUi.detailContent.innerHTML = content;
  
  // Export options are already shown/hidden in renderASRHistoryDetail
  // No need to manipulate here
  
  // Wait for DOM to update before binding events
  requestAnimationFrame(() => {
    // Remove old event listeners from export button
    const exportBtn = document.getElementById("exportOfflineBtn");
    if (exportBtn) {
      // Clone button to remove all event listeners
      const newBtn = exportBtn.cloneNode(true);
      exportBtn.parentNode.replaceChild(newBtn, exportBtn);
      
      // Add new event listener with the current record
      newBtn.addEventListener("click", () => {
        // Get selected export mode - IMPORTANT: re-query DOM to get current selection
        let exportMode = 'audio';
        if (record.type === 'asr' && record.fileType === 'video') {
          const selectedMode = document.querySelector('input[name="exportMode"]:checked');
          if (selectedMode) {
            exportMode = selectedMode.value;
            console.log('Export mode selected:', exportMode); // Debug log
          }
        }
        
        console.log('Exporting with mode:', exportMode, 'for record:', record.filename); // Debug log
        
        if (record.type === 'tts') {
          OfflineExporter.exportTTSHistory(record);
        } else if (record.type === 'asr') {
          OfflineExporter.exportASRHistory(record, exportMode);
        }
      });
    }
    
    // Initialize player and subtitles for history detail
    if (record.type === 'tts' || record.type === 'asr') {
      initHistoryPlayer(record);
    }
  });
}

// Helper function to format time
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}分${s}秒`;
}

// Render TTS history detail
function renderTTSHistoryDetail(record) {
  return `
    <div style="margin-bottom: 16px; text-align: right;">
      <button id="exportOfflineBtn" class="btn primary" style="padding: 8px 16px; font-size: 14px;">
        📥 导出离线HTML文件
      </button>
    </div>
    <div class="history-detail-player">
      <audio id="historyAudio" controls src="${record.audioUrl}"></audio>
    </div>
    
    <div class="history-detail-info">
      <div class="history-detail-info-row">
        <span class="history-detail-info-label">创建时间：</span>
        <span class="history-detail-info-value">${HistoryManager.formatDate(record.createdAt)}</span>
      </div>
      <div class="history-detail-info-row">
        <span class="history-detail-info-label">音色：</span>
        <span class="history-detail-info-value">${record.voice || "未知"}</span>
      </div>
      <div class="history-detail-info-row">
        <span class="history-detail-info-label">文件名：</span>
        <span class="history-detail-info-value">${record.filename || "未知"}</span>
      </div>
    </div>
    
    <div class="history-detail-content">
      <div class="history-detail-section">
        <div class="history-detail-section-title">📝 原文内容</div>
        <div class="textarea" style="font-size: 14px; max-height: 200px; overflow-y: auto;">${record.text || "无内容"}</div>
      </div>
      
      <div id="historyHighlightContainer" class="highlight-container" style="display: none;"></div>
      
      <div class="history-detail-section">
        <div class="history-detail-section-title">🔍 AI 分析</div>
        ${record.analysis ? `
          <div style="margin-top: 12px;">
            <div class="label">关键词</div>
            <div id="historyAnalysisKeywords" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
              ${(record.analysis.keywords || []).map(kw => `<span class="keyword-tag" style="background: var(--bg-muted); padding: 4px 12px; border-radius: 12px; font-size: 12px;">${kw}</span>`).join("")}
            </div>
          </div>
          
          <div style="margin-top: 12px;">
            <div class="label">全文摘要</div>
            <div style="margin-top: 8px; color: var(--text); line-height: 1.6; font-size: 14px;">
              ${record.analysis.summary || "无摘要"}
            </div>
          </div>
          
          <div style="margin-top: 12px;">
            <div class="label">主题分段</div>
            <ul id="historyAnalysisTopics" style="margin: 8px 0 0; padding-left: 18px; color: var(--text); font-size: 14px; line-height: 1.7;">
              ${(record.analysis.topics || []).map((topic, idx) => `
                <li class="history-topic-item" style="margin: 8px 0; cursor: default;" data-topic-idx="${idx}">
                  ${topic.title}
                </li>
              `).join("")}
            </ul>
          </div>
        ` : "<p style='color: var(--muted);'>暂无分析结果</p>"}
      </div>
    </div>
  `;
}

// Render ASR history detail
function renderASRHistoryDetail(record) {
  const fileType = record.fileType || 'audio';
  const playerHtml = record.audioUrl 
    ? (fileType === 'video' 
        ? `<video id="historyAudio" controls src="${record.audioUrl}" style="max-height: 400px;"></video>`
        : `<audio id="historyAudio" controls src="${record.audioUrl}"></audio>`)
    : "";
  
  return `
    <div class="history-detail-player">
      ${playerHtml}
    </div>
    
    <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
      <button id="exportOfflineBtn" class="btn primary" style="padding: 8px 16px; font-size: 14px;">
        📥 导出离线HTML文件
      </button>
      
      <!-- Export Options (shown next to button for video files) -->
      <div id="exportOptions" style="${fileType === 'video' ? 'display: flex;' : 'display: none;'} gap: 16px; align-items: center;">
        <label id="videoIncludedOption" style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="radio" name="exportMode" value="video">
          <span>包含视频</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="radio" name="exportMode" value="audio" checked>
          <span>仅音频</span>
        </label>
      </div>
    </div>
    
    <div class="history-detail-info">
      <div class="history-detail-info-row">
        <span class="history-detail-info-label">创建时间：</span>
        <span class="history-detail-info-value">${HistoryManager.formatDate(record.createdAt)}</span>
      </div>
      <div class="history-detail-info-row">
        <span class="history-detail-info-label">文件名：</span>
        <span class="history-detail-info-value">${record.filename || "未知"}</span>
      </div>
      <div class="history-detail-info-row">
        <span class="history-detail-info-label">转写文本长度：</span>
        <span class="history-detail-info-value">${(record.transcript || "").length} 字符</span>
      </div>
    </div>
    
    <div class="history-detail-content">
      <div class="history-detail-section">
        <div class="history-detail-section-title">📝 转写结果</div>
        <div id="historyHighlightContainer" class="highlight-container"></div>
      </div>
      
      <div class="history-detail-section">
        <div class="history-detail-section-title">🔍 AI 分析</div>
        <div style="margin-top: 12px;">
          <div class="label">关键词</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
            ${(record.keywords || []).map(kw => `<span class="keyword-tag" style="background: var(--bg-muted); padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-right: 8px;">${kw}</span>`).join("")}
          </div>
        </div>
        
        <div style="margin-top: 12px;">
          <div class="label">摘要</div>
          <p style="margin: 8px 0 0; color: var(--text); font-size: 0.9em; line-height: 1.5;">
            ${record.summary || "无摘要"}
          </p>
        </div>
        
        <div style="margin-top: 12px;">
          <div class="label">主题分段</div>
          <ul id="historyTopics" class="topic-list" style="padding-left: 20px; margin: 4px 0 0;">
            ${(record.topics || []).map(topic => `
              <li style="margin: 8px 0;">${topic.title}</li>
            `).join("")}
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Initialize history player and subtitles
function initHistoryPlayer(record) {
  const audio = document.getElementById("historyAudio");
  const highlightContainer = document.getElementById("historyHighlightContainer");
  
  if (!audio || !highlightContainer) return;
  
  const subtitles = record.subtitles || [];
  const topics = record.type === 'tts' ? (record.analysis?.topics || []) : (record.topics || []);
  
  if (subtitles.length > 0) {
    highlightContainer.style.display = "block";
    highlightContainer.innerHTML = "";
    
    subtitles.forEach((sub, idx) => {
      const span = document.createElement("span");
      span.textContent = sub.text;
      span.className = "word-span";
      span.dataset.idx = idx;
      span.dataset.start = sub.start;
      span.dataset.end = sub.end;
      highlightContainer.appendChild(span);
    });
    
    // Time update
    audio.addEventListener("timeupdate", () => {
      const time = audio.currentTime;
      const activeIdx = subtitles.findIndex(s => time >= s.start && time <= s.end);
      
      const currentActive = highlightContainer.querySelector(".word-span.active");
      if (currentActive && currentActive.dataset.idx != activeIdx) {
        currentActive.classList.remove("active");
      }
      
      if (activeIdx !== -1) {
        const target = highlightContainer.querySelector(`.word-span[data-idx="${activeIdx}"]`);
        if (target) {
          target.classList.add("active");
          if (target.offsetTop > highlightContainer.scrollTop + highlightContainer.clientHeight - 50 || 
              target.offsetTop < highlightContainer.scrollTop) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }
    });
    
    // Click to seek
    highlightContainer.addEventListener("click", (e) => {
      const target = e.target.closest(".word-span");
      if (!target) return;
      const start = parseFloat(target.dataset.start);
      if (!isNaN(start)) {
        audio.currentTime = start;
        audio.play();
      }
    });
  } else {
    highlightContainer.style.display = "none";
  }
  
  // Initialize topic items with timestamps and click functionality
  if (topics.length > 0) {
    const topicsContainerId = record.type === 'tts' ? "historyAnalysisTopics" : "historyTopics";
    const topicsContainer = document.getElementById(topicsContainerId);
    
    if (topicsContainer) {
      topicsContainer.innerHTML = "";
      
      topics.forEach((topic, idx) => {
        const li = document.createElement("li");
        li.className = "history-topic-item";
        li.dataset.topicIdx = idx;
        
        // Find timestamps based on snippets
        let startT = 0, endT = 0;
        let found = false;
        
        if (topic.start_snippet && subtitles.length > 0) {
          // Normalize both strings
          const cleanSnippet = topic.start_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
          const snippetLen = Math.min(cleanSnippet.length, 15);
          const searchStr = cleanSnippet.substring(0, snippetLen);
          
          // Find start subtitle
          let matchIdx = -1;
          
          // 1. Try exact match of first few chars in clean text
          matchIdx = subtitles.findIndex(s => {
            const cleanSub = s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
            return cleanSub.includes(searchStr);
          });
          
          // 2. Fuzzy fallback: sliding window across subtitles
          if (matchIdx === -1) {
            for (let i = 0; i < subtitles.length; i++) {
              let combined = subtitles[i].text;
              if (i + 1 < subtitles.length) combined += subtitles[i + 1].text;
              if (i + 2 < subtitles.length) combined += subtitles[i + 2].text;
              
              const cleanCombined = combined.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
              
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
              const cleanEnd = topic.end_snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").substring(0, 10);
              let endMatchIdx = -1;
              
              // Try exact match first
              endMatchIdx = subtitles.findIndex((s, idx) => idx > matchIdx && s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").includes(cleanEnd));
              
              // Fuzzy fallback for end time
              if (endMatchIdx === -1) {
                for (let i = matchIdx + 1; i < subtitles.length; i++) {
                  let combined = subtitles[i].text;
                  if (i + 1 < subtitles.length) combined += subtitles[i + 1].text;
                  if (i + 2 < subtitles.length) combined += subtitles[i + 2].text;
                  
                  const cleanCombined = combined.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
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
        
        // Render
        let timeInfo = "";
        if (found) {
          const timeStr = endT > startT ? `${formatTime(startT)}~${formatTime(endT)}` : `${formatTime(startT)}`;
          timeInfo = `<span style="color:var(--primary); font-size:0.85em; margin-left:8px;">[${timeStr}]</span>`;
          
          // Bind click
          li.style.cursor = "pointer";
          li.title = `点击跳转到 ${formatTime(startT)}`;
          li.addEventListener("click", () => {
            audio.currentTime = startT;
            audio.play();
          });
        } else {
          timeInfo = `<span style="color:var(--muted); font-size:0.85em; margin-left:8px;">[未匹配]</span>`;
        }
        
        li.innerHTML = `<span>${topic.title}</span>${timeInfo}`;
        li.style.margin = "8px 0";
        li.style.color = "var(--text)";
        li.style.fontSize = "14px";
        li.style.lineHeight = "1.7";
        
        topicsContainer.appendChild(li);
      });
    }
  }
}

loadVoices();
loadConfig();
