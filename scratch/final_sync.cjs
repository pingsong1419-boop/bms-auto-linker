const fs = require('fs');
const path = require('path');

const csvPath = path.resolve(__dirname, '../device-interfaces/cabinet_ledger.csv');
const mdPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\renesas-bms-cabinet-clean.md';
const jsonPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\src\\assets\\tester_interface.json';

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
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '');
    
    // 跳过前两行 (标题和表头)
    const dataLines = lines.slice(2);
    
    const connectors = [
        '1#120pin连接器',
        '2#120pin连接器',
        '1#90pin连接器',
        '2#90pin连接器',
        '56pin连接器',
        '3#120pin连接器'
    ];
    
    const result = {};
    connectors.forEach(c => result[c] = []);

    dataLines.forEach(line => {
        const parts = line.split(',');
        for (let i = 0; i < 6; i++) {
            const pin = parts[i * 2] ? parts[i * 2].trim() : '';
            const sig = parts[i * 2 + 1] ? parts[i * 2 + 1].trim() : '-';
            
            if (pin) {
                result[connectors[i]].push({ pin, sig });
            }
        }
    });

    // 生成 MD
    let md = "# 瑞萨-BMS功能测试柜 接口定义清单 (已同步最新全量台账)\n\n";
    const pinsForJson = [];

    Object.keys(result).forEach(conn => {
        md += `## ${conn}\n`;
        md += `| 序号 | 针脚 (PIN) | 信号定义 |\n`;
        md += `| :--- | :--- | :--- |\n`;
        
        result[conn].forEach((item, idx) => {
            md += `| ${idx + 1} | ${item.pin} | ${item.sig || '-'} |\n`;
            
            if (item.sig && item.sig !== '-' && item.sig !== '') {
                pinsForJson.push({
                    id: `md_${conn}_${item.pin}`,
                    name: item.sig,
                    originalPin: item.pin,
                    type: inferType(item.sig),
                    tags: [conn],
                    description: `模块: ${conn}`
                });
            }
        });
        md += `\n`;
    });

    fs.writeFileSync(mdPath, md, 'utf8');
    fs.writeFileSync(jsonPath, JSON.stringify(pinsForJson, null, 2), 'utf8');
    
    console.log(`Successfully synced 6 connectors from ${csvPath}`);
    console.log(`Generated ${pinsForJson.length} active signal definitions.`);

} catch (err) {
    console.error('Final Sync Error:', err.message);
    process.exit(1);
}
