import os
import sys
import json
import re
import time
import uuid
import shutil
import tempfile
import subprocess
import unicodedata
import asyncio
import requests # Added for downloading TTS audio
from http import HTTPStatus
from flask import Flask, request, jsonify, send_from_directory

# Third-party
import dashscope
from dashscope import MultiModalConversation
from dashscope.audio.tts_v2 import SpeechSynthesizer as SpeechSynthesizerV2, AudioFormat as AudioFormatV2
from dashscope.audio.asr import Transcription
# from rapidocr_onnxruntime import RapidOCR # Removed
import fitz  # PyMuPDF
import cv2
import numpy as np
import docx
from docx.shared import Pt
from docx.oxml.ns import qn
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

app = Flask(__name__, static_folder='.')

# --- Load Environment ---
def load_env_file():
    env_path = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()

load_env_file()

# --- Configuration ---
# Models requested by user
MODEL_TTS = "qwen-tts-2025-05-22"
# ASR Models Priority List
# Note: qwen-audio-asr and qwen-audio-asr-latest might strictly require OSS URLs or have different input constraints compared to turbo.
# qwen-audio-turbo-1204 is known to work with local file upload wrapper.
# If qwen-audio-asr fails with "does not support this input", it likely means it doesn't support the file:// wrapper or the format.
# We will keep the order but ensure error handling switches to next.
MODEL_ASR_LIST = ["qwen3-omni-flash", "qwen3-omni-flash-2025-09-15", "qwen3-omni-flash-2025-12-01"]
MODEL_ASR_FILE = MODEL_ASR_LIST[0] # Default
MODEL_LLM = "qwen3-max-2025-09-23"
MODEL_OCR = "qwen-vl-ocr-2025-11-20"

MAX_TTS_TEXT_LENGTH = 500_000
MAX_SAY_SEGMENT_LENGTH = 450 # Reduced from 1500 to 450 to meet [1, 512] API limit

# Initialize OCR (Removed local engine)
# ocr_engine = RapidOCR()

# --- Helper: FFmpeg ---
def ensure_ffmpeg_in_path():
    common_paths = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
    current_path = os.environ.get("PATH", "")
    for p in common_paths:
        if os.path.exists(os.path.join(p, "ffmpeg")):
            if p not in current_path:
                os.environ["PATH"] = p + os.pathsep + current_path
            return

ensure_ffmpeg_in_path()

def get_audio_duration(file_path):
    if not shutil.which("ffprobe"): return 0
    try:
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", 
               "-of", "default=noprint_wrappers=1:nokey=1", file_path]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except:
        return 0

def convert_to_wav_16k(input_path, output_path):
    if not shutil.which("ffmpeg"): return False, "ffmpeg missing"
    try:
        cmd = ["ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", 
               "-c:a", "pcm_s16le", output_path]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True, None
    except Exception as e:
        return False, str(e)

# --- Helper: Text Normalization ---
def normalize_text_for_tts(text):
    if not text: return ""
    t = str(text)
    try: t = unicodedata.normalize('NFKC', t)
    except: pass
    t = t.replace('\uFEFF', '')
    # Basic cleanup
    t = re.sub(r'[\r\n]+', '\n', t)
    return t.strip()

def split_text_for_say(text, max_len):
    # Simple split by punctuation or space
    t = str(text)
    out = []
    i = 0
    while i < len(t):
        j = min(i + max_len, len(t))
        if j < len(t):
            # Try to find split point
            window = t[i:j]
            match = re.search(r'(?:\n+|[。！？!?]\s*)', window[::-1])
            if match:
                offset = match.start()
                if offset < max_len * 0.5: # If split point is reasonably far
                    j = j - offset
        
        out.append(t[i:j].strip())
        i = j
    return [c for c in out if c]

def estimate_subtitles_helper(text, duration):
    if duration <= 0 or not text: return []
    # Simple linear alignment
    total_chars = len(text)
    if total_chars == 0: return []
    time_per_char = duration / total_chars
    
    subtitles = []
    # Split by punctuation
    parts = re.split(r'([，。！？；：,.!?;:])', text)
    current_time = 0.0
    
    buffer = ""
    for p in parts:
        buffer += p
        if p and p in "，。！？；：,.!?;:":
            # Flush buffer
            chunk_dur = len(buffer) * time_per_char
            subtitles.append({
                "text": buffer,
                "begin_time": int(current_time * 1000), # ms
                "end_time": int((current_time + chunk_dur) * 1000) # ms
            })
            current_time += chunk_dur
            buffer = ""
    if buffer:
        chunk_dur = len(buffer) * time_per_char
        subtitles.append({
            "text": buffer,
            "begin_time": int(current_time * 1000),
            "end_time": int((current_time + chunk_dur) * 1000)
        })
        
    return subtitles

# --- Backend: Alibaba TTS ---
class AlibabaTTSBackend:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.environ.get("DASHSCOPE_API_KEY")
        
    def get_voices(self):
        # qwen-tts-2025-05-22 supported voices
        return [
            {"name": "Cherry", "locale": "zh-CN", "description": "标准女声 (Cherry)"},
            {"name": "Ethan", "locale": "zh-CN", "description": "标准男声 (Ethan)"},
            {"name": "Chelsie", "locale": "zh-CN", "description": "温柔女声 (Chelsie)"},
            {"name": "Serena", "locale": "zh-CN", "description": "亲切女声 (Serena)"},
            {"name": "Dylan", "locale": "zh-CN", "description": "北京口音 (Dylan)"},
            {"name": "Jada", "locale": "zh-CN", "description": "上海口音 (Jada)"},
            {"name": "Sunny", "locale": "zh-CN", "description": "四川口音 (Sunny)"}
        ]

    def generate(self, text, voice, output_path):
        if not self.api_key:
            return False, "Missing API Key", None
        
        dashscope.api_key = self.api_key
        
        # Determine parameters
        model = MODEL_TTS
        voice_id = voice
        
        try:
            # Use MultiModalConversation for qwen-tts
            print(f"TTS Call: model={model}, voice={voice_id}, text_len={len(text)}", file=sys.stderr)
            
            response = MultiModalConversation.call(
                model=model,
                text=text,
                voice=voice_id,
            )
            
            if response.status_code == HTTPStatus.OK:
                # qwen-tts returns an audio URL in output.audio.url
                if hasattr(response.output, 'audio') and 'url' in response.output.audio:
                    audio_url = response.output.audio['url']
                    
                    # Download the audio
                    r = requests.get(audio_url)
                    r.raise_for_status()
                    
                    with open(output_path, "wb") as f:
                        f.write(r.content)
                        
                    # Fake subtitles (Estimate)
                    duration = get_audio_duration(output_path)
                    raw_subs = estimate_subtitles_helper(text, duration)
                    subtitles = []
                    for s in raw_subs:
                        subtitles.append({
                            "text": s['text'],
                            "start": s['begin_time'] / 1000.0,
                            "end": s['end_time'] / 1000.0
                        })
                    return True, None, subtitles
                else:
                    return False, f"Unexpected response format: {response}", None
            else:
                if "free tier of the model has been exhausted" in str(response.message):
                     return False, "阿里云DashScope Qwen-TTS模型免费额度已耗尽。请前往阿里云控制台开启“按量付费”或购买资源包以继续使用。", None
                return False, f"TTS API Error: {response.message}", None
                
        except Exception as e:
            error_msg = str(e)
            if "AllocationQuota.FreeTierOnly" in error_msg or "free tier" in error_msg.lower():
                return False, "阿里云DashScope免费额度已耗尽。请前往阿里云控制台开启“按量付费”或购买资源包以继续使用。(错误代码: AllocationQuota.FreeTierOnly)", None
            return False, error_msg, None

    def estimate_subtitles(self, text, duration):
        # Legacy method kept for compatibility if needed, but generate() uses helper now.
        # Actually generate() uses local logic above.
        pass

# --- Backend: Alibaba ASR ---
def run_ali_asr(file_path, api_key):
    dashscope.api_key = api_key
    
    # 1. Compress/Extract to mp3
    compressed_path = file_path
    is_temp = False
    
    if shutil.which("ffmpeg"):
        try:
            fd, temp_path = tempfile.mkstemp(suffix=".mp3")
            os.close(fd)
            # -ac 1: mono
            # -b:a 64k: slightly higher bitrate to avoid artifacts
            cmd = ["ffmpeg", "-y", "-i", file_path, 
                   "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", 
                   temp_path]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            compressed_path = temp_path
            is_temp = True
        except Exception as e:
            print(f"ASR Compression Warning: {e}", file=sys.stderr)
            is_temp = False
            compressed_path = file_path

    # 2. Check Duration and Chunk if necessary
    # Qwen-Audio has timeout issues on long files. We split if > 300s.
    CHUNK_DURATION = 300
    duration = get_audio_duration(compressed_path)
    
    final_text = ""
    all_sentences = []
    
    # Local helper for cleanup
    def clean_asr_hallucinations(t):
        if not t: return ""
        t = str(t)
        
        # 0. Remove known model hallucinations/prefixes
        bad_prefixes = [
            "这段音频的原始内容是",
            "这段音频的内容是",
            "音频内容是",
            "转写结果如下",
            "请准确转写",
            "这段音频"
        ]
        for p in bad_prefixes:
            t = t.replace(p, "")
            
        # 1. Squash repeated characters (often hallucinations)
        # Replace any character repeated 4 or more times with a single instance
        t = re.sub(r'(.)\1{3,}', r'\1', t)
        
        # 2. Basic punctuation cleanup (as safeguard)
        # Fix double punctuation from raw output
        t = re.sub(r'([，。！？；：,.!?;:])\1+', r'\1', t)
        # Fix space around punctuation
        t = re.sub(r'\s*([，。！？；：,.!?;:])\s*', r'\1', t)
        
        # 3. Trim
        return t.strip()

    try:
        if duration <= CHUNK_DURATION:
            # Direct call
            ok, res = _call_qwen_audio(compressed_path)
            if not ok: return False, res
            
            # Clean (Basic Regex)
            res = clean_asr_hallucinations(res)
            
            final_text = res
            
            # Generate subtitles
            all_sentences = estimate_subtitles_helper(res, duration)
            
        else:
            # Chunking
            print(f"Audio too long ({duration}s), splitting...", file=sys.stderr)
            with tempfile.TemporaryDirectory() as chunk_dir:
                # ffmpeg segment
                # -f segment -segment_time 300 -c copy
                # Note: '-c copy' can sometimes produce chunks with weird timestamps or incomplete headers if keyframes don't align.
                # Re-encoding ensures valid standalone files.
                seg_pattern = os.path.join(chunk_dir, "chunk_%03d.mp3")
                cmd = ["ffmpeg", "-i", compressed_path, "-f", "segment", 
                       "-segment_time", str(CHUNK_DURATION), "-ar", "16000", "-ac", "1", "-b:a", "64k", seg_pattern]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                
                chunks = sorted([os.path.join(chunk_dir, f) for f in os.listdir(chunk_dir) if f.endswith(".mp3")])
                
                current_offset_ms = 0
                
                for i, chunk in enumerate(chunks):
                    print(f"Processing chunk {i+1}/{len(chunks)}...", file=sys.stderr)
                    
                    # Get exact duration of chunk for better alignment
                    chunk_dur = get_audio_duration(chunk)
                    
                    ok, res = _call_qwen_audio(chunk)
                    if not ok: 
                        print(f"Chunk {i} failed: {res}", file=sys.stderr)
                        final_text += f"\n[...片段 {i+1} 转写失败，内容缺失...]\n"
                        # We must advance time even if failed to keep alignment
                        current_offset_ms += int(chunk_dur * 1000)
                        continue 
                    
                    # Convert to string and clean up
                    if isinstance(res, list): 
                         res = " ".join([str(x) for x in res])
                    elif not isinstance(res, str):
                         res = str(res)
                    
                    # Post-processing to remove hallucinations (e.g. repeated "呃")
                    res = clean_asr_hallucinations(res)
                    
                    final_text += res + "\n"
                    
                    # Generate subtitles for this chunk
                    chunk_subs = estimate_subtitles_helper(res, chunk_dur)
                    
                    # Adjust offsets
                    for sub in chunk_subs:
                        sub['begin_time'] += current_offset_ms
                        sub['end_time'] += current_offset_ms
                        all_sentences.append(sub)
                        
                    current_offset_ms += int(chunk_dur * 1000)

        
        return True, {"text": final_text, "sentences": all_sentences}

    except Exception as e:
        return False, str(e)
    finally:
        if is_temp and os.path.exists(compressed_path):
            os.remove(compressed_path)

def _call_qwen_audio(audio_path):
    # Try models in order
    last_error = ""
    
    for model_name in MODEL_ASR_LIST:
        try:
            print(f"ASR Trying model: {model_name}", file=sys.stderr)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"audio": f"file://{audio_path}"},
                        {"text": "请逐字逐句完整转写这段音频，输出结果时请自动去掉语气词、口头禅（如“呃”、“啊”、“那个”、“就是”等）和重复词，修正显而易见的口误，并使用规范的标点符号。不要进行总结，直接输出清洗后的转写文本。"}
                    ]
                }
            ]
            
            # Qwen3-Omni-Flash requires streaming
            # and might require explicit result collection
            response_iterator = MultiModalConversation.call(
                model=model_name, 
                messages=messages,
                stream=True
            )
            
            full_content = ""
            last_response = None
            
            print(f"DEBUG: Starting stream for {model_name}", file=sys.stderr)
            
            for response in response_iterator:
                last_response = response
                if response.status_code == HTTPStatus.OK:
                    # Accumulate content if it's incremental
                    # Check structure
                    if hasattr(response.output, 'choices') and len(response.output.choices) > 0:
                        choice = response.output.choices[0]
                        # DashScope stream usually returns FULL content so far in 'message.content'
                        # But let's check if it's delta
                        
                        # Note: Qwen-Audio-Turbo returned full content. 
                        # Qwen3-Omni-Flash via OpenAI compatible mode returns Deltas.
                        # Via DashScope SDK? It likely standardizes to Full Content OR Deltas.
                        # The symptom "Content len: 1" implies it returns DELTAS.
                        
                        # Let's try to grab content and see.
                        part = choice.message.content
                        
                        # If list (multimodal output?), process it
                        if isinstance(part, list):
                            # Usually [{"text": "..."}]
                            text_part = ""
                            for item in part:
                                if isinstance(item, dict) and 'text' in item:
                                    text_part += item['text']
                                elif isinstance(item, str):
                                    text_part += item
                            
                            if text_part:
                                full_content += text_part # APPEND, don't overwrite
                        
                        elif isinstance(part, str):
                            if part: full_content += part # APPEND, don't overwrite
                            
                else:
                    print(f"Stream Error Chunk: {response}", file=sys.stderr)
                    # Don't raise immediately, try to continue? No, stream error is fatal usually.
                    raise Exception(f"Stream Error: {response.message}")
            
            print(f"DEBUG: Stream finished. Content len: {len(full_content)}", file=sys.stderr)
            
            if full_content:
                return True, full_content
            elif last_response and last_response.status_code == HTTPStatus.OK:
                 # If full_content is empty but we had success, maybe it's in a different field?
                 # Just return empty string and let the outer loop handle "failed" if it's critical?
                 # But outer loop sees True and prints it.
                 return True, ""
            else:
                response = last_response if last_response else response # Fallback
                # Check for quota error
                err_msg = str(response.message).lower()
                # Also check for "does not support this input" which means model might not support file URL or format
                # But here we are iterating models. 
                # If qwen-audio-asr fails with "does not support this input", maybe it's because we use file://
                # qwen-audio-asr (VL model) supports file:// if local? 
                # Actually, standard qwen-audio-asr/latest DOES NOT support local file:// in MultiModalConversation call unless using specific SDK utils or if dashscope handles it.
                # BUT qwen-audio-turbo-1204 (and turbo) DOES support it via the same SDK method if it's the specific "turbo" variant that handles uploads.
                
                # However, previous code worked with qwen-audio-turbo-1204.
                # Now we added qwen-audio-asr and qwen-audio-asr-latest to the list.
                # If these models don't support file:// upload transparently, they will fail with 400 InvalidParameter.
                
                # To fix this: Ensure we are using a compatible method or only using models that support it.
                # qwen-audio-asr (opensource Qwen-Audio-Chat) deployed on DashScope usually supports the same input.
                # But if it fails, we should treat it as "model failed" and switch.
                
                if "free tier" in err_msg or "quota" in err_msg or "payment" in err_msg or "arrearage" in err_msg or "does not support this input" in err_msg:
                    print(f"ASR Model {model_name} failed/unsupported ({response.code}), switching...", file=sys.stderr)
                    last_error = f"{model_name} error: {response.message}"
                    continue # Try next model
                else:
                    # Other error, might be persistent
                    print(f"ASR Model {model_name} failed: {response.message}", file=sys.stderr)
                    last_error = f"{model_name} error: {response.message}"
                    continue

        except Exception as e:
            print(f"ASR Model {model_name} exception: {e}", file=sys.stderr)
            last_error = str(e)
            continue
            
    return False, f"All ASR models failed. Last error: {last_error}"

# --- Backend: Alibaba NLP (LLM) ---
def call_llm_analysis(text, api_key):
    dashscope.api_key = api_key
    prompt = f"""
    Please analyze the following text and provide a JSON response with these fields:
    1. "keywords": list of top 5 keywords (strings).
    2. "summary": a concise summary (string).
    3. "topics": list of objects, each with:
       - "title" (string): topic description.
       - "start_snippet" (string): the exact first 15-20 characters of this section in the text.
       - "end_snippet" (string): the exact last 10 characters of this section.
    
    Text:
    {text[:15000]} 
    """
    try:
        resp = dashscope.Generation.call(
            model=MODEL_LLM,
            messages=[{'role': 'user', 'content': prompt}],
            result_format='message'
        )
        
        if resp.status_code == HTTPStatus.OK:
            content = resp.output.choices[0].message.content
            # Strip markdown code blocks if present
            content = re.sub(r'```json\s*|\s*```', '', content)
            try:
                data = json.loads(content)
                return True, data
            except:
                return False, f"Invalid JSON from LLM: {content}"
        else:
            return False, f"LLM Error: {resp.message}"
    except Exception as e:
        return False, str(e)

def call_llm_fix_punctuation(text, api_key):
    dashscope.api_key = api_key
    prompt = f"""
    你是一个专业的文本编辑器。请对下面的文本进行“智能标点修复”和“全文排版优化”。
    
    要求：
    1. 【标点修复】：根据上下文语义，添加或修正标点符号，使断句准确、通顺。
    2. 【文本清洗】：去除多余的空格（尤其是PDF提取导致的字间空格）、删除无意义的换行符，将断裂的句子合并。
    3. 【排版优化】：保持合理的段落结构，增加全文的可读性。
    4. 【错别字修正】：修正明显的同音错别字。
    5. 【输出格式】：直接返回修复后的纯文本，不要包含任何解释、前言或后缀。
    
    文本：
    {text[:8000]}
    """
    try:
        resp = dashscope.Generation.call(
            model=MODEL_LLM,
            messages=[{'role': 'user', 'content': prompt}],
            result_format='message'
        )
        if resp.status_code == HTTPStatus.OK:
            return True, resp.output.choices[0].message.content
        return False, resp.message
    except Exception as e:
        return False, str(e)

def call_llm_advice(text, api_key):
    dashscope.api_key = api_key
    prompt = f"""
    你是一位资深的中学语文教师。请阅读以下作文，提供针对性的高分修改建议。
    
    要求：
    1. 指出文章的亮点和不足。
    2. 提供具体的修改建议，包括词语替换、句式调整或段落重组。
    3. 如果有精彩的润色语句，请用【高亮】（如 **加粗** 或特殊的标记）标出，以便前端展示。
    4. 返回格式为 JSON，包含两个字段：
       - "analysis": 整体点评（字符串）。
       - "suggestions": 修改建议列表，每项包含 "original"（原文片段，可选）、"suggestion"（修改建议，支持 markdown 高亮）、"reason"（修改理由）。
    
    作文内容：
    {text[:8000]}
    """
    try:
        resp = dashscope.Generation.call(
            model=MODEL_LLM, # qwen3-max-2025-09-23
            messages=[{'role': 'user', 'content': prompt}],
            result_format='message'
        )
        if resp.status_code == HTTPStatus.OK:
            content = resp.output.choices[0].message.content
            # Strip markdown code blocks
            content = re.sub(r'```json\s*|\s*```', '', content)
            try:
                return True, json.loads(content)
            except:
                return False, f"Invalid JSON: {content}"
        return False, resp.message
    except Exception as e:
        return False, str(e)



# --- Backend: Alibaba OCR (Qwen-VL-OCR) ---
def call_qwen_ocr(image_path, api_key):
    dashscope.api_key = api_key
    
    # Qwen-VL-OCR logic
    # It works like a chat model with image input
    
    messages = [
        {
            "role": "user",
            "content": [
                {"image": f"file://{image_path}"},
                {"text": "Read the text in this image. Return only the text content without markdown code blocks or extra explanations."}
            ]
        }
    ]
    
    try:
        resp = MultiModalConversation.call(
            model=MODEL_OCR,
            messages=messages
        )
        
        if resp.status_code == HTTPStatus.OK:
            return True, resp.output.choices[0].message.content[0]['text']
        else:
            return False, f"OCR Error: {resp.message}"
    except Exception as e:
        return False, str(e)

# --- Routes ---

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/voices', methods=['GET'])
def api_voices():
    # Return Alibaba voices
    backend = AlibabaTTSBackend()
    return jsonify({"ok": True, "voices": backend.get_voices()})

@app.route('/api/get-config', methods=['GET'])
def api_get_config():
    # Return non-sensitive config, or mask key if needed
    # Since this is a local tool, returning the key for auto-fill is acceptable
    key = os.environ.get("DASHSCOPE_API_KEY", "")
    return jsonify({"ok": True, "dashscopeKey": key})

@app.route('/api/tts', methods=['POST'])
def api_tts():
    try:
        data = request.get_json()
        text = normalize_text_for_tts(data.get("text", ""))
        voice = data.get("voice", "longanyang") # Default updated
        key = data.get("dashscopeKey")
        
        if not key: key = os.environ.get("DASHSCOPE_API_KEY")
        if not key: return jsonify({"ok": False, "error": "missing_api_key"}), 401
        
        # Log key usage (masked)
        masked_key = f"{key[:6]}...{key[-4:]}" if key and len(key) > 10 else "InvalidKey"
        print(f"TTS Request: Voice={voice}, Key={masked_key}", file=sys.stderr)
        
        if not text: return jsonify({"ok": False, "error": "empty_text"}), 400
        
        backend = AlibabaTTSBackend(key)
        
        # Filename setup
        filename = f"tts-{uuid.uuid4()}.wav"
        out_dir = os.path.join(os.getcwd(), "tts_output")
        os.makedirs(out_dir, exist_ok=True)
        final_path = os.path.join(out_dir, filename)
        
        # Check length
        if len(text) <= MAX_SAY_SEGMENT_LENGTH:
            ok, err, subs = backend.generate(text, voice, final_path)
            if not ok: return jsonify({"ok": False, "error": err}), 500
            
            return jsonify({
                "ok": True,
                "audio_url": f"/tts_output/{filename}",
                "subtitles": subs,
                "download_filename": filename
            })
        else:
            # Segment and merge
            with tempfile.TemporaryDirectory() as temp_dir:
                segments = split_text_for_say(text, MAX_SAY_SEGMENT_LENGTH)
                seg_files = []
                all_subs = []
                current_offset = 0.0
                
                for i, seg in enumerate(segments):
                    seg_path = os.path.join(temp_dir, f"seg_{i}.wav")
                    ok, err, subs = backend.generate(seg, voice, seg_path)
                    if not ok: return jsonify({"ok": False, "error": f"Segment {i} failed: {err}"}), 500
                    
                    # Adjust subs
                    dur = get_audio_duration(seg_path)
                    for s in subs:
                        s['start'] += current_offset
                        s['end'] += current_offset
                    all_subs.extend(subs)
                    current_offset += dur
                    
                    seg_files.append(seg_path)
                    time.sleep(0.2) # Rate limit protection
                
                # Merge
                list_path = os.path.join(temp_dir, "list.txt")
                with open(list_path, "w") as f:
                    for p in seg_files: f.write(f"file '{p}'\n")
                
                try:
                    subprocess.run(
                        ["ffmpeg", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", final_path],
                        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                    )
                except Exception as e:
                    return jsonify({"ok": False, "error": f"Merge failed: {e}"}), 500
                
                return jsonify({
                    "ok": True,
                    "audio_url": f"/tts_output/{filename}",
                    "subtitles": all_subs,
                    "download_filename": filename
                })
                
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route('/api/asr', methods=['POST'])
def api_asr():
    if 'file' not in request.files: return jsonify({"ok": False, "error": "missing_file"}), 400
    file = request.files['file']
    
    key = request.form.get("dashscopeKey") or os.environ.get("DASHSCOPE_API_KEY")
    # For ASR, we might need a key. If not provided in form (frontend update needed?), check ENV.
    # We will assume ENV is primary or frontend sends it.
    
    if not key: return jsonify({"ok": False, "error": "missing_api_key"}), 401
    
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = os.path.join(temp_dir, file.filename)
        file.save(input_path)
        
        ok, res = run_ali_asr(input_path, key)
        if not ok: return jsonify({"ok": False, "error": res}), 500
        
        # Parse Result
        # res structure from qwen3-asr-flash needs careful handling
        # Assuming res is the result object from SDK
        
        # We need to extract transcript, subtitles, etc.
        # Since I cannot easily debug the exact response structure of qwen3-asr-flash without running it,
        # I will assume standard SenseVoice/Paraformer style or generic JSON.
        
        # If result contains 'sentences', we use it.
        transcript = ""
        subtitles = []
        
        # Try to extract from result object or dict
        if hasattr(res, 'sentences'):
            sents = res.sentences
        elif isinstance(res, dict) and 'sentences' in res:
            sents = res['sentences']
        else:
            sents = []
            # Maybe full text is in 'text' field?
            # res might be the whole 'output' object from wait()
            pass
            
        if hasattr(res, 'text'): transcript = res.text
        elif isinstance(res, dict) and 'text' in res: transcript = res['text']
        
        # --- REMOVED GLOBAL NLP CLEANUP ---
        # It was causing text loss and timestamp misalignment.
        # Now cleanup is done per-chunk inside run_ali_asr.
        
        # If run_ali_asr didn't provide sentences (e.g. error fallback or legacy path), try to use what we have
        if not subtitles and sents:
             for s in sents:
                text_s = s['text'] if isinstance(s, dict) else s.text
                start = s['begin_time'] if isinstance(s, dict) else s.begin_time
                end = s['end_time'] if isinstance(s, dict) else s.end_time
                subtitles.append({
                    "text": text_s,
                    "start": start / 1000.0,
                    "end": end / 1000.0
                })

        # Analyze
        # Use LLM for analysis as requested (qwen3-max)
        ok_llm, llm_data = call_llm_analysis(transcript, key)
        keywords = []
        summary = ""
        topics = []
        if ok_llm:
            keywords = llm_data.get("keywords", [])
            summary = llm_data.get("summary", "")
            topics = llm_data.get("topics", [])
            
        return jsonify({
            "ok": True,
            "transcript": transcript,
            "subtitles": subtitles,
            "keywords": keywords,
            "summary": summary,
            "topics": topics,
            "analysis": llm_data if ok_llm else None
        })

@app.route('/api/analyze-text', methods=['POST'])
def api_analyze_text():
    data = request.get_json()
    text = data.get('text', '')
    key = data.get('dashscopeKey') or os.environ.get("DASHSCOPE_API_KEY")
    
    if not key: return jsonify({"ok": False, "error": "missing_api_key"}), 401
    
    ok, res = call_llm_analysis(text, key)
    if not ok: return jsonify({"ok": False, "error": res}), 500
    
    return jsonify({"ok": True, "data": res})

@app.route('/api/fix-punctuation', methods=['POST'])
def api_fix_punctuation():
    data = request.get_json()
    text = data.get('text', '')
    key = data.get('dashscopeKey') or os.environ.get("DASHSCOPE_API_KEY")
    
    if not key: return jsonify({"ok": False, "error": "missing_api_key"}), 401
    
    ok, res = call_llm_fix_punctuation(text, key)
    if not ok: return jsonify({"ok": False, "error": res}), 500
    
    return jsonify({"ok": True, "text": res})

@app.route('/api/ai-advice', methods=['POST'])
def api_ai_advice():
    data = request.get_json()
    text = data.get('text', '')
    key = data.get('dashscopeKey') or os.environ.get("DASHSCOPE_API_KEY")
    
    if not key: return jsonify({"ok": False, "error": "missing_api_key"}), 401
    
    ok, res = call_llm_advice(text, key)
    if not ok: return jsonify({"ok": False, "error": res}), 500
    
    return jsonify({"ok": True, "data": res})

@app.route('/api/generate-advice-word', methods=['POST'])
def api_generate_advice_word():
    try:
        data = request.get_json()
        original_text = data.get('original_text', '')
        advice_data = data.get('advice_data', {})
        
        doc = docx.Document()
        
        # Styles
        style = doc.styles['Normal']
        font = style.font
        font.name = 'Times New Roman'
        font.size = Pt(12)
        font.element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
        
        # Title
        doc.add_heading('作文润色与修改建议', 0)
        
        # Original Text
        doc.add_heading('原文内容', 1)
        doc.add_paragraph(original_text)
        
        # Analysis
        doc.add_heading('整体点评', 1)
        doc.add_paragraph(advice_data.get('analysis', ''))
        
        # Suggestions
        doc.add_heading('详细修改建议', 1)
        suggestions = advice_data.get('suggestions', [])
        for i, sug in enumerate(suggestions):
            p = doc.add_paragraph()
            p.add_run(f"{i+1}. ").bold = True
            if sug.get('original'):
                p.add_run(f"原文：{sug['original']}\n").italic = True
            
            # Remove markdown bold for docx readability or parse it?
            # Simple cleanup for now
            clean_sug = sug['suggestion'].replace('**', '').replace('__', '')
            p.add_run(f"建议：{clean_sug}\n").bold = True
            p.add_run(f"理由：{sug['reason']}")
            
        fname = f"advice-{uuid.uuid4()}.docx"
        out_dir = os.path.join(os.getcwd(), "tts_output")
        os.makedirs(out_dir, exist_ok=True)
        doc.save(os.path.join(out_dir, fname))
        
        return jsonify({"ok": True, "download_url": f"/tts_output/{fname}", "filename": fname})
        
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# --- Utils: File Extraction (Kept from original) ---
@app.route('/api/extract-text', methods=['POST'])
def api_extract_text():
    if 'file' not in request.files: return jsonify({"ok": False, "error": "missing_file"}), 400
    file = request.files['file']
    if not file.filename: return jsonify({"ok": False, "error": "empty"}), 400
    
    content = file.read()
    ext = os.path.splitext(file.filename)[1].lower()
    text = ""
    
    try:
        if ext == ".pdf":
            # Use PyMuPDF (fitz)
            with fitz.open(stream=content, filetype="pdf") as doc:
                for page in doc: text += page.get_text() + "\n"
        elif ext == ".docx":
            with tempfile.TemporaryDirectory() as td:
                p = os.path.join(td, "in.docx")
                with open(p, "wb") as f: f.write(content)
                doc = docx.Document(p)
                text = "\n".join([p.text for p in doc.paragraphs])
        elif ext == ".txt":
            try: text = content.decode('utf-8')
            except: text = content.decode('gbk', errors='ignore')
        else:
            return jsonify({"ok": False, "error": "unsupported"}), 400
            
        return jsonify({"ok": True, "text": normalize_text_for_tts(text)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

def call_llm_format_essay(text, api_key):
    dashscope.api_key = api_key
    prompt = f"""
    你是一个专业的出版编辑。请对以下OCR识别出的作文文本进行严格的标准化排版和格式校对。
    
    【目标】：输出符合标准出版物要求的作文文本。
    
    【具体要求】：
    1. **段落修正**：智能识别段落，合并被OCR错误断行的句子，确保段落完整。
    2. **缩进处理**：每个自然段的开头必须严格保持 **两个全角空格（　　）** 的缩进。
    3. **标点规范**：
       - 将所有英文标点转换为中文全角标点（如 , -> ，）。
       - 修正OCR可能导致的标点缺失或错误。
    4. **文本清洗**：去除文中多余的空格、乱码符号或页眉页脚干扰文本。
    5. **标题处理**：如果第一行疑似标题，请将其居中（在文本中通过前后加空行体现，或者不做特殊标记，仅确保其独立成段且无缩进，但通常作文正文段落需缩进）。
       * 为了通用性，请对所有正文段落添加缩进。如果第一行明显是标题，可以不缩进但需独立成行。
    6. **输出纯文本**：只返回排版后的文本内容，不要包含任何 JSON 格式、Markdown 标记或解释性语言。
    
    【待处理文本】：
    {text[:10000]}
    """
    try:
        resp = dashscope.Generation.call(
            model=MODEL_LLM, # qwen3-max
            messages=[{'role': 'user', 'content': prompt}],
            result_format='message'
        )
        if resp.status_code == HTTPStatus.OK:
            return True, resp.output.choices[0].message.content
        return False, resp.message
    except Exception as e:
        return False, str(e)

@app.route('/api/ocr-to-word', methods=['POST'])
def api_ocr_to_word():
    # Use Qwen-VL-OCR for all OCR tasks
    files = request.files.getlist('file')
    if not files or not files[0].filename:
        return jsonify({"ok": False, "error": "missing_file"}), 400
    
    # NOTE: We rely on the client (frontend) to send files in the correct order.
    # Previously we sorted by filename, but that prevents users from manually ordering files
    # (e.g. "Part2.jpg" then "Part1.jpg" if they really wanted to, or if filenames are messy).
    # The frontend now implements a Queue system to guarantee order.
    
    # We need API key for Qwen
    key = request.form.get("dashscopeKey") or os.environ.get("DASHSCOPE_API_KEY")
    if not key: return jsonify({"ok": False, "error": "missing_api_key (please configure in settings)"}), 401

    full_text = []
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Process files sequentially in order
            for idx, file in enumerate(files):
                content = file.read()
                filename = file.filename.lower()
                
                print(f"Processing file {idx+1}/{len(files)}: {filename}", file=sys.stderr)
                
                if filename.endswith(".pdf"):
                     with fitz.open(stream=content, filetype="pdf") as doc:
                        for i, page in enumerate(doc):
                            pix = page.get_pixmap()
                            img_path = os.path.join(temp_dir, f"f{idx}_p{i}.png")
                            pix.save(img_path)
                            
                            ok, text = call_qwen_ocr(img_path, key)
                            if ok: full_text.append(text)
                            else: print(f"OCR Failed for {filename} page {i}: {text}", file=sys.stderr)
                            
                else:
                    # Image
                    img_path = os.path.join(temp_dir, f"f{idx}_img.png")
                    with open(img_path, "wb") as f: f.write(content)
                    
                    ok, text = call_qwen_ocr(img_path, key)
                    if ok: full_text.append(text)
                    else: 
                        # Continue or fail? Let's append error message to text to warn user
                        full_text.append(f"[Error reading file {filename}: {text}]")
            
        final_text = "\n\n".join(full_text)
        
        # Basic cleanup of markdown code blocks if Qwen returns them despite prompt
        final_text = re.sub(r'```.*?\n', '', final_text)
        final_text = final_text.replace('```', '')
        
        # Apply formatting via LLM for publication standard
        ok_fmt, formatted_text = call_llm_format_essay(final_text, key)
        
        # Fallback to regex if LLM fails
        if not ok_fmt:
            print(f"Format LLM Failed: {formatted_text}, using fallback.", file=sys.stderr)
            formatted_text = format_as_essay(final_text)
        
        return jsonify({"ok": True, "text": formatted_text})
        
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route('/api/generate-word', methods=['POST'])
def api_generate_word():
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({"ok": False, "error": "empty_text"}), 400
            
        doc = docx.Document()
        
        # Set Default Style
        style = doc.styles['Normal']
        font = style.font
        font.name = 'Times New Roman'
        font.size = Pt(12) # 12pt (Xiao Si)
        font.element.rPr.rFonts.set(qn('w:eastAsia'), '宋体') # SimSun
        
        # Paragraph Formatting
        pf = style.paragraph_format
        pf.line_spacing = 1.5 # 1.5 lines spacing
        pf.space_after = Pt(0)
        pf.space_before = Pt(0)
        
        for paragraph in text.split('\n'):
            if paragraph.strip():
                p = doc.add_paragraph(paragraph.strip())
                # Ensure alignment is justified or left
                p.alignment = WD_PARAGRAPH_ALIGNMENT.JUSTIFY
        
        fname = f"ocr-{uuid.uuid4()}.docx"
        out_dir = os.path.join(os.getcwd(), "tts_output")
        os.makedirs(out_dir, exist_ok=True)
        doc.save(os.path.join(out_dir, fname))
        
        return jsonify({"ok": True, "download_url": f"/tts_output/{fname}", "filename": fname})
        
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

def format_as_essay(text):
    if not text: return ""
    # Normalize newlines
    text = re.sub(r'\n\s*\n', '\n\n', text)
    return text.strip()

@app.route('/api/asr-to-docx', methods=['POST'])
def api_asr_to_docx():
    # Export ASR result to Word
    data = request.get_json()
    doc = docx.Document()
    doc.add_heading('ASR Report', 0)
    
    if data.get('summary'):
        doc.add_heading('Summary', 1)
        doc.add_paragraph(data['summary'])
        
    if data.get('keywords'):
        doc.add_heading('Keywords', 1)
        doc.add_paragraph(", ".join(data['keywords']))
        
    doc.add_heading('Transcript', 1)
    doc.add_paragraph(data.get('transcript', ''))
    
    fname = f"asr-{uuid.uuid4()}.docx"
    out_dir = os.path.join(os.getcwd(), "tts_output")
    os.makedirs(out_dir, exist_ok=True)
    doc.save(os.path.join(out_dir, fname))
    
    return jsonify({"ok": True, "download_url": f"/tts_output/{fname}", "filename": fname})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5173))
    # Ensure DashScope Key is present
    if not os.environ.get("DASHSCOPE_API_KEY"):
        print("WARNING: DASHSCOPE_API_KEY not found in environment.", file=sys.stderr)
    
    app.run(host='0.0.0.0', port=port)
