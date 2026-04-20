import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const excelPath = 'C:\\Users\\95403\\Desktop\\瑞萨\\瑞萨-BMS功能测试柜接口定义表.xlsx';
const outputMdPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\renesas-bms-cabinet-clean.md';

try {
  const workbook = XLSX.readFile(excelPath);
  const resultRows = [];

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    // 使用 {header: 1} 获取原始数组
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    
    if (data.length < 2) return;

    // 第一行通常包含连接器名称
    const connectorRow = data[0];
    const connectors = [];
    
    // 找出所有连接器及其起始列
    for (let c = 0; c < connectorRow.length; c++) {
        if (connectorRow[c] && String(connectorRow[c]).includes('连接器')) {
            connectors.push({ name: String(connectorRow[c]).trim(), columnStart: c });
        }
    }

    // 处理每个连接器
    connectors.forEach((conn, index) => {
        const nextConn = connectors[index + 1];
        const nextConnCol = nextConn ? nextConn.columnStart : data[0].length;
        
        // 信号列通常是两两一对的（脚位 + 信号）
        // 我们遍历该连接器范围内的所有列
        for (let subC = conn.columnStart; subC < nextConnCol; subC += 2) {
            // 从第三行开始是实际数据
            for (let r = 2; r < data.length; r++) {
                const row = data[r];
                const pinNum = String(row[subC] || "").trim();
                const signalName = String(row[subC + 1] || "").trim();
                
                // 排除空行或表头逻辑
                if (pinNum && pinNum !== "脚位" && signalName && signalName !== "定义") {
                    resultRows.push(`| ${conn.name} | ${pinNum} | ${signalName} |`);
                }
            }
        }
    });
  });

  const mdContent = [
    "# 瑞萨-BMS功能测试柜 接口定义清单",
    "",
    "> 格式优化版：按 [连接器], [脚位], [定义] 三列扁平化展示，方便查对。",
    "",
    "| 连接器 | 脚位 | 信号定义 |",
    "| :--- | :--- | :--- |",
    ...resultRows,
    ""
  ].join('\n');

  fs.writeFileSync(outputMdPath, mdContent);
  console.log(`Successfully updated Markdown at: ${outputMdPath}`);
} catch (error) {
  console.error('Error processing Excel file:', error.message);
  process.exit(1);
}
