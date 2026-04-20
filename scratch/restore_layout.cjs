const fs = require('fs');
const path = require('path');

const csvPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\cabinet_ledger.csv';
const mdPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\renesas-bms-cabinet.md';

const connectors = [
    '1#120pin连接器',
    '2#120pin连接器',
    '1#90pin连接器',
    '2#90pin连接器',
    '56pin连接器',
    '3#120pin连接器'
];

try {
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '');
    const dataLines = lines.slice(2);
    
    const tableData = [];
    dataLines.forEach(line => {
        const parts = line.split(',');
        for (let i = 0; i < 6; i++) {
            const pin = parts[i * 2] ? parts[i * 2].trim() : '';
            const sig = parts[i * 2 + 1] ? parts[i * 2 + 1].trim() : '-';
            if (pin) {
                tableData.push({ conn: connectors[i], pin, sig });
            }
        }
    });

    // 重新按连接器顺序排序 (确保大表也是有序的)
    tableData.sort((a, b) => connectors.indexOf(a.conn) - connectors.indexOf(b.conn));

    let md = "# 瑞萨-BMS功能测试柜 接口定义清单 (经典全量表模式)\n\n";
    md += "| 序号 | 连接器名称 | 针脚 (PIN) | 信号定义 |\n";
    md += "| :--- | :--- | :--- | :--- |\n";

    tableData.forEach((item, idx) => {
        md += `| ${idx + 1} | ${item.conn} | ${item.pin} | ${item.sig || '-'} |\n`;
    });

    fs.writeFileSync(mdPath, md, 'utf8');
    console.log(`Successfully restored classic table layout to ${mdPath}`);

} catch (err) {
    console.error('Layout Restore Error:', err.message);
    process.exit(1);
}
