// ============================================
// 工具函数模块
// ============================================

const Utils = {
    /**
     * 格式化时间为 "X分Y秒" 格式
     */
    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}分${s}秒`;
    },

    /**
     * 根据片段在字幕中匹配时间戳
     */
    findTimestampBySnippet(snippet, subtitles, isEnd = false) {
        if (!snippet || subtitles.length === 0) return null;

        const cleanSnippet = snippet.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
        const snippetLen = Math.min(cleanSnippet.length, 15);
        const searchStr = cleanSnippet.substring(0, snippetLen);

        let matchIdx = -1;

        // 1. 精确匹配
        matchIdx = subtitles.findIndex(s => {
            const cleanSub = s.text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
            return cleanSub.includes(searchStr);
        });

        // 2. 模糊匹配：在连续的多个字幕中搜索
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
            return isEnd ? subtitles[matchIdx].end : subtitles[matchIdx].start;
        }

        return null;
    },

    /**
     * 显示加载状态
     */
    showLoading(disabledElement, text) {
        disabledElement.disabled = true;
        if (text) disabledElement.textContent = text;
    },

    /**
     * 隐藏加载状态
     */
    hideLoading(disabledElement, originalText) {
        disabledElement.disabled = false;
        if (originalText) disabledElement.textContent = originalText;
    },

    /**
     * 显示错误提示
     */
    showError(message) {
        alert(message);
    }
};

// ============================================
// UI 渲染模块
// ============================================

const UI = {
    /**
     * 渲染关键词标签
     */
    renderKeywords(keywords, container) {
        container.innerHTML = "";
        (keywords || []).forEach(kw => {
            const tag = document.createElement("span");
            tag.className = "keyword-tag";
            tag.textContent = kw;
            tag.style.marginRight = "8px";
            container.appendChild(tag);
        });
    },

    /**
     * 渲染主题列表
     */
    renderTopics(topics, subtitles, container, player) {
        container.innerHTML = "";

        (topics || []).forEach(topic => {
            const li = document.createElement("li");
            li.className = "topic-item";

            const startT = Utils.findTimestampBySnippet(topic.start_snippet, subtitles);
            let endT = 0;
            if (topic.end_snippet) {
                endT = Utils.findTimestampBySnippet(topic.end_snippet, subtitles, true) || 0;
            }

            let timeInfo = "";
            if (startT !== null) {
                const timeStr = endT > startT ? `${Utils.formatTime(startT)}~${Utils.formatTime(endT)}` : Utils.formatTime(startT);
                timeInfo = `<span style="color:var(--primary); font-size:0.85em; margin-left:8px;">[${timeStr}]</span>`;

                li.style.cursor = "pointer";
                li.title = `点击跳转到 ${Utils.formatTime(startT)}`;
                li.addEventListener("click", () => {
                    player.currentTime = startT;
                    player.play();
                });
            } else {
                timeInfo = `<span style="color:var(--muted); font-size:0.85em; margin-left:8px;">[未匹配]</span>`;
            }

            li.innerHTML = `<span>${topic.title}</span>${timeInfo}`;
            container.appendChild(li);
        });
    },

    /**
     * 渲染建议项
     */
    renderSuggestionItem(item, idx) {
        const div = document.createElement("div");
        div.style.marginBottom = "16px";
        div.style.padding = "12px";
        div.style.border = "1px solid var(--border)";
        div.style.borderRadius = "6px";
        div.style.background = "var(--bg)";

        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <strong>建议 ${idx + 1}</strong>
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
        return div;
    },

    /**
     * 渲染风格示范
     */
    renderStyleDemo(demo) {
        const card = document.createElement('div');
        card.style.marginBottom = "24px";
        card.style.padding = "16px";
        card.style.borderRadius = "8px";
        card.style.background = "#fff";
        card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
        card.style.border = "1px solid #e5e7eb";

        // 风格标题颜色
        let titleColor = "#333";
        let badgeColor = "#e5e7eb";
        if (demo.style_name.includes("中考")) {
            titleColor = "#16a34a";
            badgeColor = "#dcfce7";
        } else if (demo.style_name.includes("散文")) {
            titleColor = "#9333ea";
            badgeColor = "#f3e8ff";
        } else if (demo.style_name.includes("思辨")) {
            titleColor = "#2563eb";
            badgeColor = "#dbeafe";
        }

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
                        <div style="font-size:0.9em; font-weight:bold; color:#555; margin-bottom:4px;">示例 ${i + 1}</div>`;

            if (ex.original_snippet) {
                html += `<div style="font-size:0.9em; color:#666; margin-bottom:6px; font-style:italic; padding-left: 8px; border-left: 2px solid #ccc;">
                            原文："${ex.original_snippet}"
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
        return card;
    },

    /**
     * 渲染完整的建议内容
     */
    renderAdviceContent(adviceData, container) {
        // 1. 评分与分析
        const scoreHtml = adviceData.score_prediction
            ? `<div style="font-size: 1.2em; font-weight: bold; color: var(--primary); margin-bottom: 8px;">${adviceData.score_prediction}</div>`
            : '';
        container.innerHTML = scoreHtml + (adviceData.analysis || "无总体评价");

        // 2. 结构建议
        if (adviceData.structure_advice) {
            const structDiv = document.createElement('div');
            structDiv.style.margin = "16px 0";
            structDiv.style.padding = "12px";
            structDiv.style.background = "#f0f9ff";
            structDiv.style.borderLeft = "4px solid #0ea5e9";
            structDiv.innerHTML = `<h4 style="margin:0 0 8px 0;">🏗️ 写作思路与结构进阶</h4>
                                   <div style="font-size:0.95em; white-space: pre-wrap;">${adviceData.structure_advice}</div>`;
            container.appendChild(structDiv);
        }

        // 3. 构思拓展
        if (adviceData.alternative_ideas && adviceData.alternative_ideas.length > 0) {
            const ideaDiv = document.createElement('div');
            ideaDiv.style.margin = "16px 0";
            ideaDiv.style.padding = "12px";
            ideaDiv.style.background = "#fff7ed";
            ideaDiv.style.borderLeft = "4px solid #f97316";

            let ideaHtml = `<h4 style="margin:0 0 12px 0; color:#c2410c;">💡 多维审题与构思拓展</h4>`;
            adviceData.alternative_ideas.forEach(idea => {
                ideaHtml += `<div style="margin-bottom:8px;">
                                <div style="font-weight:bold; color:#ea580c;">${idea.title}</div>
                                <div style="font-size:0.95em; color:#431407;">${idea.desc}</div>
                             </div>`;
            });
            ideaDiv.innerHTML = ideaHtml;
            container.appendChild(ideaDiv);
        }

        // 4. 详细建议
        if (adviceData.suggestions && adviceData.suggestions.length > 0) {
            const listHeader = document.createElement('h4');
            listHeader.textContent = "✍️ 细节润色与手法升级";
            listHeader.style.margin = "20px 0 8px 0";
            container.appendChild(listHeader);

            adviceData.suggestions.forEach((item, idx) => {
                container.appendChild(this.renderSuggestionItem(item, idx));
            });
        }

        // 5. 风格示范
        if (adviceData.style_demonstrations && adviceData.style_demonstrations.length > 0) {
            const styleHeader = document.createElement('h4');
            styleHeader.textContent = "🎨 三种风格润色示范 (每种风格 3 例)";
            styleHeader.style.margin = "24px 0 12px 0";
            container.appendChild(styleHeader);

            adviceData.style_demonstrations.forEach(demo => {
                container.appendChild(this.renderStyleDemo(demo));
            });
        }
    }
};

// ============================================
// 原始代码开始
// ============================================

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
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
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

    Utils.showLoading(ui.generateAudio, "生成中...");
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

        analyzeText();

    } catch (e) {
        setStatus("生成失败: " + e.message);
    } finally {
        Utils.hideLoading(ui.generateAudio, "生成语音 (Qwen-TTS)");
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
            const container = ui.highlightContainer;

            const eleTop = target.offsetTop;
            const eleBottom = target.offsetTop + target.offsetHeight;
            const containerTop = container.scrollTop;
            const containerBottom = container.scrollTop + container.clientHeight;

            if (eleTop < containerTop || eleBottom > containerBottom) {
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

        // 关键词
        UI.renderKeywords(result.keywords, ui.analysisKeywords);

        // 摘要
        ui.analysisSummary.textContent = result.summary || "（无摘要）";

        // 主题
        UI.renderTopics(result.topics, state.subtitles, ui.analysisTopics, ui.audioPlayer);

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

    Utils.showLoading(ui.startAsr, "转写中...");
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

        UI.renderKeywords(data.keywords, ui.asrKeywords);
        ui.asrSummary.textContent = data.summary || "（无摘要）";
        UI.renderTopics(data.topics, state.asrSubtitles, ui.asrTopics, ui.asrAudioPlayer);

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
        Utils.hideLoading(ui.startAsr, "开始转写");
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
        ui.ocrFileList.innerHTML = "(暂无文件，请点击"添加文件"按钮)";
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

        div.appendChild(nameSpan);
        ui.ocrFileList.appendChild(div);
    });
}

ui.ocrFile.addEventListener("change", () => {
    const files = Array.from(ui.ocrFile.files);
    if (files.length === 0) return;

    if (ocrFileQueue.length + files.length > 10) {
        alert(`最多只能添加 10 个文件。当前已添加 ${ocrFileQueue.length} 个，尝试添加 ${files.length} 个。`);
        return;
    }

    const validFiles = [];
    const tooLargeFiles = [];

    files.forEach(f => {
        if (f.size > 4 * 1024 * 1024) {
            tooLargeFiles.push(f.name);
        } else {
            validFiles.push(f);
        }
    });

    if (tooLargeFiles.length > 0) {
        alert(`以下文件超过 4MB 限制，无法添加（请压缩后重试）：\n${tooLargeFiles.join("\n")}`);
    }

    if (validFiles.length > 0) {
        ocrFileQueue = ocrFileQueue.concat(validFiles);
        renderOcrFileList();
    }

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

    Utils.showLoading(ui.startOcr, `正在转换 ${ocrFileQueue.length} 个文件...`);
    ui.ocrResult.classList.add("hidden");

    const form = new FormData();
    for (let i = 0; i < ocrFileQueue.length; i++) {
        form.append("file", ocrFileQueue[i]);
    }
    form.append("dashscopeKey", dashscopeKey);

    try {
        const res = await fetch("/api/ocr-to-word", { method: "POST", body: form });

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
        Utils.hideLoading(ui.startOcr, "开始转换");
    }
}

ui.startOcr.addEventListener("click", startOcr);

async function generateWord() {
    const text = ui.ocrResultText.value;
    if (!text) {
        alert("没有可保存的内容。");
        return;
    }

    Utils.showLoading(ui.generateWord, "生成中...");

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
        Utils.hideLoading(ui.generateWord, "保存并生成 Word 文档");
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

    Utils.showLoading(ui.getAiAdvice, "正在分析...");
    if (ui.submitCustomPrompt) Utils.showLoading(ui.submitCustomPrompt, "分析中...");

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

            const isCustomFormat = customPrompt && currentAdviceData.custom_format === true;

            if (isCustomFormat) {
                ui.adviceAnalysis.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.6;">${currentAdviceData.analysis || "无分析内容"}</div>`;
                ui.adviceList.innerHTML = "";
            } else {
                UI.renderAdviceContent(currentAdviceData, ui.adviceList);
            }

            ui.adviceSection.scrollIntoView({ behavior: "smooth" });

        } else {
            alert("获取建议失败: " + (data.error || "未知错误"));
        }
    } catch (e) {
        alert("请求出错: " + e.message);
    } finally {
        Utils.hideLoading(ui.getAiAdvice, "AI 建议 (作文润色)");
        if (ui.submitCustomPrompt) Utils.hideLoading(ui.submitCustomPrompt, "输入修改prompt建议");
    }
}

async function exportAdvice() {
    if (!currentAdviceData) return;

    const original_text = ui.ocrResultText.value;
    Utils.showLoading(ui.exportAdvice, "导出中...");

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
        Utils.hideLoading(ui.exportAdvice, "导出建议为 Word");
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

    Utils.showLoading(ui.importPdf, "解析中...");
    ui.generateAudio.disabled = true;
    const form = new FormData();
    form.append("file", file);

    try {
        const res = await fetch("/api/extract-text", { method: "POST", body: form });
        const data = await res.json();
        if (data.ok) {
            let rawText = data.text;
            ui.text.value = rawText;
            ui.text.placeholder = "正在进行智能标点修复和排版优化，请稍候...";
            ui.text.style.opacity = "0.6";

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
        Utils.hideLoading(ui.importPdf, "导入文本 (自动修复标点)");
        ui.generateAudio.disabled = false;
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

    Utils.showLoading(ui.importUrl, "提取中...");
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
        Utils.hideLoading(ui.importUrl, "导入");
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

loadVoices();
loadConfig();
