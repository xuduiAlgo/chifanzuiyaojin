const OfflineExporterV2 = require('./js/offline-exporter-v2.js');
const fs = require('fs');
const path = require('path');

async function generateHTML() {
    console.log('开始生成离线HTML文件...\n');

    const record = {
        type: 'asr',
        filename: '加拿大总理卡尼访华谈合作',
        audioUrl: '/tts_output/asr-sample.mp3',
        fileType: 'audio',
        transcript: '北京时间2026年1月16日，加拿大总理马克·卡尼在北京结束了与中国国家主席习近平的会晤。随后，两国发表了一项未被称为自由贸易协定，但是实质上却是打破了过去两年加中两国贸易封锁格局的协议。',
        subtitles: [
            { start: 0, end: 3.211, text: '北京时间2026年1月16日，' },
            { start: 3.211, end: 9.635, text: '加拿大总理马克·卡尼在北京结束了与中国国家主席习近平的会晤。' },
            { start: 9.635, end: 10.277, text: '随后，' },
            { start: 10.277, end: 14.132, text: '两国发表了一项未被称为自由贸易协定，' },
            { start: 14.132, end: 20.127, text: '但是实质上却是打破了过去两年加中两国贸易封锁格局的协议。' }
        ],
        keywords: ['加拿大', '中国', '电动汽车', '战略合作伙伴关系', '关税'],
        summary: '2026年1月，加拿大总理马克·卡尼访华，与中国达成一项突破性贸易协议。',
        topics: [
            {
                title: '加中达成突破性贸易协议及战略伙伴关系',
                start_snippet: '北京时间2026年1月16日',
                end_snippet: '长远布局。'
            },
            {
                title: '贸易协议细节：电动车配额与农业关税调整',
                start_snippet: '我们先说贸易破冰，也就',
                end_snippet: '一次真正的破冰。'
            }
        ]
    };

    try {
        const result = await OfflineExporterV2.export(record, 'asr');
        
        fs.writeFileSync(result.html.filename, result.html.content);
        
        if (result.media) {
            const buffer = await result.media.blob.arrayBuffer();
            fs.writeFileSync(result.media.filename, Buffer.from(buffer));
        }
        
        const outputData = {
            html: {
                filename: result.html.filename,
                size: result.html.size
            },
            media: result.media ? {
                filename: result.media.filename,
                size: result.media.size
            } : null,
            mapping: result.mapping
        };
        
        fs.writeFileSync('output.json', JSON.stringify(outputData, null, 2));
        
        console.log('\n✅ 生成成功！');
        console.log(`📄 HTML文件: ${result.html.filename} (${formatSize(result.html.size)})`);
        if (result.media) {
            console.log(`🎵 媒体文件: ${result.media.filename} (${formatSize(result.media.size)})`);
        }
        console.log(`📋 映射信息: ${result.mapping.mode === 'base64' ? 'Base64内嵌模式' : '分离模式'}`);
        console.log(`\n📝 输出文件: output.json`);
        
    } catch (error) {
        console.error('❌ 生成失败:', error.message);
        process.exit(1);
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

generateHTML();