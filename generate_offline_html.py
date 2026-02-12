#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime

def format_size(bytes_size):
    if bytes_size == 0:
        return '0 B'
    k = 1024
    sizes = ['B', 'KB', 'MB', 'GB']
    i = int((bytes_size.bit_length() - 1) // 10)
    return f'{bytes_size / (k ** i):.2f} {sizes[i]}'

def generate_sample_record():
    return {
        'type': 'asr',
        'filename': '加拿大总理卡尼访华谈合作',
        'audioUrl': '/tts_output/asr-sample.mp3',
        'fileType': 'audio',
        'transcript': '北京时间2026年1月16日，加拿大总理马克·卡尼在北京结束了与中国国家主席习近平的会晤。随后，两国发表了一项未被称为自由贸易协定，但是实质上却是打破了过去两年加中两国贸易封锁格局的协议。',
        'subtitles': [
            {'start': 0, 'end': 3.211, 'text': '北京时间2026年1月16日，'},
            {'start': 3.211, 'end': 9.635, 'text': '加拿大总理马克·卡尼在北京结束了与中国国家主席习近平的会晤。'},
            {'start': 9.635, 'end': 10.277, 'text': '随后，'},
            {'start': 10.277, 'end': 14.132, 'text': '两国发表了一项未被称为自由贸易协定，'},
            {'start': 14.132, 'end': 20.127, 'text': '但是实质上却是打破了过去两年加中两国贸易封锁格局的协议。'}
        ],
        'keywords': ['加拿大', '中国', '电动汽车', '战略合作伙伴关系', '关税'],
        'summary': '2026年1月，加拿大总理马克·卡尼访华，与中国达成一项突破性贸易协议。',
        'topics': [
            {
                'title': '加中达成突破性贸易协议及战略伙伴关系',
                'start_snippet': '北京时间2026年1月16日',
                'end_snippet': '长远布局。'
            },
            {
                'title': '贸易协议细节：电动车配额与农业关税调整',
                'start_snippet': '我们先说贸易破冰，也就',
                'end_snippet': '一次真正的破冰。'
            }
        ]
    }

def generate_html_content(record, export_type):
    timestamp = datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
    html_filename = f'offline-{export_type}-{timestamp}.html'
    
    html_template = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{record['filename']} - 离线查看</title>
    <style>
        :root {{
            --primary: #5b8cff;
            --text: #333333;
            --bg: #ffffff;
            --bg-muted: #f5f5f5;
        }}
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: var(--text);
            line-height: 1.6;
        }}
        .container {{
            max-width: 1000px;
            margin: 0 auto;
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
            color: white;
        }}
        .title {{
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 8px;
        }}
        .card {{
            background: var(--bg);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        .player-container {{
            margin-bottom: 16px;
        }}
        .player-container audio {{
            width: 100%;
            border-radius: 8px;
        }}
        .highlight-container {{
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            padding: 16px;
            background: var(--bg-muted);
            border-radius: 8px;
            max-height: 300px;
            overflow-y: auto;
            line-height: 1.6;
        }}
        .word-span {{
            padding: 2px 4px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
        }}
        .word-span:hover {{
            background: rgba(91, 140, 255, 0.1);
            border-color: var(--primary);
        }}
        .word-span.active {{
            background: rgba(91, 140, 255, 0.25);
            border-color: var(--primary);
            color: var(--primary);
            font-weight: 500;
        }}
        .keyword-tag {{
            display: inline-block;
            padding: 6px 12px;
            background: var(--bg-muted);
            border-radius: 16px;
            font-size: 0.9em;
            margin-right: 8px;
            margin-bottom: 8px;
            border: 1px solid #e0e0e0;
        }}
        .content-text {{
            padding: 16px;
            background: var(--bg-muted);
            border-radius: 8px;
            max-height: 400px;
            overflow-y: auto;
            line-height: 1.8;
            white-space: pre-wrap;
        }}
        .footer {{
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: white;
            opacity: 0.8;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title">{record['filename']}</h1>
            <p>离线查看模式</p>
        </header>

        <section class="card">
            <div class="player-container">
                <label>音频播放器</label>
                <audio id="mediaPlayer" controls src="{record['audioUrl']}">
                    您的浏览器不支持音频播放。
                </audio>
            </div>
        </section>

        <section class="card">
            <h2>交互式字幕</h2>
            <p style="color: #666; font-size: 0.9em;">点击字幕可跳转到对应位置</p>
            <div id="highlightContainer" class="highlight-container"></div>
        </section>

        <section class="card">
            <h2>AI 分析结果</h2>
            <div style="margin-bottom: 16px;">
                <label>关键词</label>
                <div style="margin-top: 8px;">
                    {' '.join([f'<span class="keyword-tag">{kw}</span>' for kw in record.get('keywords', [])])}
                </div>
            </div>
            <div style="margin-bottom: 16px;">
                <label>全文摘要</label>
                <div style="margin-top: 8px; color: var(--text); line-height: 1.6;">
                    {record.get('summary', '无摘要')}
                </div>
            </div>
        </section>

        <section class="card">
            <h2>原文内容</h2>
            <div class="content-text">{record.get('transcript', '无内容')}</div>
        </section>

        <footer class="footer">
            <p>由 AI 语音工作台生成 | 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </footer>
    </div>

    <script>
        window.subtitlesData = {json.dumps(record.get('subtitles', []), ensure_ascii=False)};

        document.addEventListener('DOMContentLoaded', function() {{
            const player = document.getElementById('mediaPlayer');
            const highlightContainer = document.getElementById('highlightContainer');
            
            if (!player || !highlightContainer) return;
            
            const subtitles = window.subtitlesData || [];
            
            if (subtitles.length > 0) {{
                highlightContainer.innerHTML = subtitles.map((sub, idx) => {{
                    return '<span class="word-span" data-idx="' + idx + '" data-start="' + sub.start + '" data-end="' + sub.end + '">' + sub.text + '</span>';
                }}).join('');
            }} else {{
                highlightContainer.innerHTML = '<p style="color: #666;">暂无字幕数据</p>';
            }}
            
            player.addEventListener('timeupdate', function() {{
                const time = player.currentTime;
                const activeIdx = subtitles.findIndex(s => time >= s.start && time <= s.end);
                
                const currentActive = highlightContainer.querySelector('.word-span.active');
                if (currentActive && currentActive.dataset.idx != activeIdx) {{
                    currentActive.classList.remove('active');
                }}
                
                if (activeIdx !== -1) {{
                    const target = highlightContainer.querySelector('.word-span[data-idx="' + activeIdx + '"]');
                    if (target) {{
                        target.classList.add('active');
                        const container = highlightContainer;
                        if (target.offsetTop > container.scrollTop + container.clientHeight - 50 || 
                            target.offsetTop < container.scrollTop) {{
                            target.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
                        }}
                    }}
                }}
            }});
            
            highlightContainer.addEventListener('click', function(e) {{
                const target = e.target.closest('.word-span');
                if (!target) return;
                const start = parseFloat(target.dataset.start);
                if (!isNaN(start)) {{
                    player.currentTime = start;
                    player.play();
                }}
            }});
        }});
    </script>
</body>
</html>'''
    
    return html_filename, html_template

def main():
    print('开始生成离线HTML文件...\\n')
    
    record = generate_sample_record()
    export_type = 'asr'
    
    html_filename, html_content = generate_html_content(record, export_type)
    
    with open(html_filename, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    output_data = {
        'html': {
            'filename': html_filename,
            'size': len(html_content)
        },
        'media': None,
        'mapping': {
            'htmlFile': html_filename,
            'mediaFile': None,
            'type': export_type,
            'mode': 'base64',
            'createdAt': datetime.now().isoformat()
        }
    }
    
    with open('output.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print('\\n✅ 生成成功！')
    print(f'📄 HTML文件: {html_filename} ({format_size(len(html_content))})')
    print(f'📋 映射信息: Base64内嵌模式')
    print(f'\\n📝 输出文件: output.json')

if __name__ == '__main__':
    main()