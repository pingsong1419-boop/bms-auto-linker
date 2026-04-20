const fs = require('fs');
const path = require('path');

const mdPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\renesas-bms-cabinet-clean.md';
const csvPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\cabinet_ledger.csv';

const connectors = [
    '1#120pin连接器',
    '2#120pin连接器',
    '1#90pin连接器',
    '2#90pin连接器',
    '56pin连接器',
    '3#120pin连接器'
];

try {
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const lines = mdContent.split('\n');
    
    const data = {};
    let currentC = '';
    
    // 1. 从 MD 中提取数据
    lines.forEach(line => {
        const h = line.match(/^##\s+(.+)/);
        if (h) {
            currentC = h[1].trim();
            data[currentC] = [];
        }
        const r = line.match(/^\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (r && currentC) {
            data[currentC].push({ pin: r[1].trim(), sig: r[2].trim() });
        }
    });

    // 2. 构造 CSV 内容 (6列并排格式)
    let csvHeader1 = connectors.join(',,') + ',\n';
    let csvHeader2 = '脚位,定义,'.repeat(6).slice(0, -1) + '\n';
    
    // 找出最大行数
    const maxLen = Math.max(...connectors.map(c => (data[c] || []).length));
    
    let csvBody = '';
    for (let i = 0; i < maxLen; i++) {
        let row = [];
        for (let j = 0; j < 6; j++) {
            const conn = connectors[j];
            const item = (data[conn] || [])[i];
            row.push(item ? item.pin : '');
            row.push(item ? (item.sig === '-' ? '' : item.sig) : '');
        }
        csvBody += row.join(',') + '\n';
    }

    fs.writeFileSync(csvPath, csvHeader1 + csvHeader2 + csvBody, 'utf8');
    console.log(`Successfully back-synced manual MD edits to ${csvPath}`);

} catch (err) {
    console.error('Reverse Sync Error:', err.message);
    process.exit(1);
}
