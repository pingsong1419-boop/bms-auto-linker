import fs from 'fs';
import path from 'path';

const mdPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\renesas-bms-cabinet-clean.md';
const outputJsonPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\src\\assets\\tester_interface.json';

function inferType(name) {
  const n = name.toUpperCase();
  if (n.includes('CAN')) return 'CAN';
  if (n.includes('VCC') || n.includes('POWER') || n.includes('源') || n.includes('+')) return 'HV';
  if (n.includes('GND') || n.includes('PE') || n.includes('地') || n.includes('-')) return 'GND';
  if (n.includes('PWM') || n.includes('输出')) return 'DO';
  if (n.includes('温感') || n.includes('NTC') || n.includes('检测')) return 'AI';
  return 'UNKNOWN';
}

try {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const lines = content.split('\n');
  const pins = [];

  lines.forEach((line, index) => {
    // 匹配 Markdown 表格行: | 连接器 | 脚位 | 信号定义 |
    const match = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    
    if (match) {
      const connector = match[1].trim();
      const pinId = match[2].trim();
      const signalName = match[3].trim();

      // 跳过表头
      if (connector === '连接器' || connector.startsWith(':---')) return;

      pins.push({
        id: `md_pin_${index}`,
        name: signalName,
        originalPin: pinId,
        type: inferType(signalName),
        tags: [connector],
        description: `模块: ${connector}`
      });
    }
  });

  fs.writeFileSync(outputJsonPath, JSON.stringify(pins, null, 2));
  console.log(`Successfully synced ${pins.length} pins from ${mdPath} to ${outputJsonPath}`);
} catch (error) {
  console.error('Error syncing from MD to JSON:', error.message);
  process.exit(1);
}
