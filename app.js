const ui = {
  text: document.getElementById("text"),
  pdfFile: document.getElementById("pdfFile"),
  importPdf: document.getElementById("importPdf"),
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
  getAiAdvice: document.getElementById("getAiAdvice"),
  adviceSection: document.getElementById("adviceSection"),
  adviceAnalysis: document.getElementById("adviceAnalysis"),
  adviceList: document.getElementById("adviceList"),
  exportAdvice: document.getElementById("exportAdvice"),
  ocrStatus: document.getElementById("ocrStatus"),
  asrFile: document.getElementById("asrFile"),
  startAsr: document.getElementById("startAsr"),
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
};

const state = {
  sayVoices: [],
  subtitles: [],
  asrSubtitles: [],
  pdfJsReady: false
};

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
    if (!data.ok) throw new Error(data.error);
    
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
    
    // Trigger Analysis
    analyzeText();
    
  } catch (e) {
    setStatus("生成失败: " + e.message);
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

    const form = new FormData();
    form.append("file", file);
    form.append("dashscopeKey", dashscopeKey);

    try {
        const res = await fetch("/api/asr", { method: "POST", body: form });
        const data = await res.json();
        
        if (!data.ok) throw new Error(data.error);
        
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
        
        const blobUrl = URL.createObjectURL(file);
        if (file.type.startsWith("video") || file.name.endsWith(".mkv")) {
            ui.asrVideoPlayer.src = blobUrl;
            ui.asrVideoPlayer.style.display = "block";
            ui.asrAudioPlayer.style.display = "none";
        } else {
            ui.asrAudioPlayer.src = blobUrl;
            ui.asrAudioPlayer.style.display = "block";
            ui.asrVideoPlayer.style.display = "none";
        }
        
        ui.asrStatus.textContent = "转写完成！";
        
    } catch (e) {
        ui.asrStatus.textContent = "错误: " + e.message;
    } finally {
        ui.startAsr.disabled = false;
        ui.startAsr.textContent = "开始转写";
    }
}

ui.startAsr.addEventListener("click", startAsr);

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
    
    // Append
    ocrFileQueue = ocrFileQueue.concat(files);
    renderOcrFileList();
    
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
      const data = await res.json();
      if (data.ok) {
          ui.ocrResult.classList.remove("hidden");
          ui.ocrResultText.value = data.text;
          ui.ocrStatus.textContent = "识别成功！请检查并编辑结果，然后点击保存生成 Word。";
      } else {
          ui.ocrStatus.textContent = "错误: " + data.error;
      }
  } catch (e) {
      ui.ocrStatus.textContent = "错误: " + e.message;
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
    
    ui.getAiAdvice.disabled = true;
    ui.getAiAdvice.textContent = "正在分析...";
    ui.adviceSection.classList.add("hidden");
    
    try {
        const res = await fetch("/api/ai-advice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, dashscopeKey })
        });
        
        const data = await res.json();
        if (data.ok && data.data) {
            currentAdviceData = data.data;
            ui.adviceSection.classList.remove("hidden");
            ui.adviceAnalysis.textContent = currentAdviceData.analysis || "无总体评价";
            
            ui.adviceList.innerHTML = "";
            (currentAdviceData.suggestions || []).forEach((item, idx) => {
                const div = document.createElement("div");
                div.style.marginBottom = "12px";
                div.style.padding = "8px";
                div.style.borderLeft = "3px solid var(--primary)";
                div.style.background = "rgba(0,0,0,0.03)";
                
                let html = `<div><strong>建议 ${idx+1}:</strong></div>`;
                if (item.original) {
                    html += `<div style="color:var(--muted); font-size:0.9em;">原文：${item.original}</div>`;
                }
                
                // Process markdown bold for highlighting
                const highlighted = item.suggestion.replace(/\*\*(.*?)\*\*/g, '<span style="color:#d9534f; font-weight:bold;">$1</span>');
                html += `<div style="margin:4px 0;">建议：${highlighted}</div>`;
                html += `<div style="font-size:0.9em; color:var(--text);">理由：${item.reason}</div>`;
                
                div.innerHTML = html;
                ui.adviceList.appendChild(div);
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

loadVoices();
loadConfig();
