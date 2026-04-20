const fs = require('fs');
const path = require('path');

const srcMd = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\renesas-bms-cabinet.md';
const destJson = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\src\\assets\\tester_interface.json';

function inferType(name) {
    if (!name || name === '-') return 'UNKNOWN';
    const n = name.toUpperCase();
    if (n.includes('CAN')) return 'CAN';
    if (n.includes('POWER') || n.includes('源') || n.includes('+') || n.includes('24V')) return 'HV';
    if (n.includes('GND') || n.includes('PE') || n.includes('-')) return 'GND';
    if (n.includes('PLC') || n.includes('输出') || n.includes('短接')) return 'DO';
    if (n.includes('NTC') || n.includes('温感') || n.includes('检测') || n.includes('万用表')) return 'AI';
    return 'UNKNOWN';
}

try {
    const md = fs.readFileSync(srcMd, 'utf8');
    const lines = md.split('\n');
    const pins = [];
    
    lines.forEach(line => {
        // 匹配格式: | 序号 | 连接器名称 | 针脚 (PIN) | 信号定义 |
        const r = line.match(/^\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (r) {
            const connector = r[1].trim();
            const pin = r[2].trim();
            const sig = r[3].trim();
            
            if (sig && sig !== '-' && sig !== '信号定义') {
                pins.push({
                    id: `${connector}_${pin}`,
                    name: sig,
                    originalPin: pin,
                    type: inferType(sig),
                    tags: [connector],
                    description: `源自大表: ${connector}`
                });
            }
        }
    });

    fs.writeFileSync(destJson, JSON.stringify(pins, null, 2), 'utf8');
    console.log(`Successfully synced ${pins.length} active signals from Classic Table to Frontend.`);

} catch (err) {
    console.error('Final Frontend Sync Error:', err.message);
    process.exit(1);
}
