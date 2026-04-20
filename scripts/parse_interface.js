import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const excelPath = 'C:\\Users\\95403\\Desktop\\瑞萨\\瑞萨-BMS功能测试柜接口定义表.xlsx';
const outputJsonPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\src\\assets\\devices\\renesas-bms-cabinet.json';

try {
  const outputDir = path.dirname(outputJsonPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const workbook = XLSX.readFile(excelPath);
  const allPins = [];

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    
    if (data.length < 2) return;

    const connectorRow = data[0];
    const connectors = [];
    for (let c = 0; c < connectorRow.length; c++) {
        if (connectorRow[c] && String(connectorRow[c]).includes('连接器')) {
            connectors.push({ name: String(connectorRow[c]).trim(), columnStart: c });
        }
    }

    connectors.forEach(conn => {
        const nextConn = connectors.find(nc => nc.columnStart > conn.columnStart);
        const columnLimit = nextConn ? nextConn.columnStart : data[0].length;

        for (let r = 2; r < data.length; r++) {
            const row = data[r];
            for (let subC = conn.columnStart; subC < columnLimit; subC += 2) {
                const pinNum = String(row[subC] || "").trim();
                const signalName = String(row[subC + 1] || "").trim();
                
                if (pinNum && pinNum !== "脚位" && signalName) {
                    allPins.push({
                        id: `T_${conn.name}_${pinNum}_${allPins.length}`, // Unique ID
                        name: signalName,
                        type: "UNKNOWN", // Default type
                        tags: [conn.name],
                        originalPin: pinNum,
                        description: `模块: ${sheetName}`
                    });
                }
            }
        }
    });
  });

  fs.writeFileSync(outputJsonPath, JSON.stringify(allPins, null, 2));
  console.log(`Successfully generated software-ready JSON at: ${outputJsonPath}`);
} catch (error) {
  console.error('Error processing Excel file:', error.message);
}
