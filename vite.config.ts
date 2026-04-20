import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'python-bridge',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/export-python' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                console.log(`[API] 接收到导出请求，数据长度: ${body.length} bytes`);
                const requestId = Date.now();
                const tempFile = path.resolve(__dirname, `temp_${requestId}.json`);
                fs.writeFileSync(tempFile, body);
                const scriptPath = path.resolve(__dirname, 'scripts/export_report.py');
                
                exec(`py "${scriptPath}" --json "${tempFile}"`, (error, stdout, stderr) => {
                  if (error) {
                    console.error("[API] Python 执行错误:", stderr);
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: stderr || error.message }));
                  } else {
                    console.log("[API] Python 执行成功:", stdout.substring(0, 100));
                    const match = stdout.match(/EXPORT_SUCCESS:(.*)/);
                    if (match) {
                      const outputPath = match[1].trim();
                      if (fs.existsSync(outputPath)) {
                        const fileContent = fs.readFileSync(outputPath);
                        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                        res.setHeader('Content-Disposition', `attachment; filename="Export.xlsx"`);
                        res.end(fileContent);
                        fs.unlinkSync(outputPath);
                      }
                    } else {
                      res.setHeader('Content-Type', 'application/json');
                      res.statusCode = 500;
                      res.end(JSON.stringify({ success: false, error: "报表生成格式异常: " + stdout }));
                    }
                  }
                  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                });
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: String(e) }));
              }
            });
          } else if (req.url === '/api/save-config' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const { deviceId, configData } = payload;
                if (!deviceId) throw new Error('未提供设备 ID');
                
                const filePath = path.resolve(__dirname, `src/assets/devices/${deviceId}.json`);
                // 确保目录存在
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                
                fs.writeFileSync(filePath, JSON.stringify(configData, null, 2), 'utf-8');
                
                // 为了向后兼容，如果修改的是 renesas，同步更新根目录文件
                if (deviceId === 'renesas') {
                   const legacyPath = path.resolve(__dirname, 'src/assets/tester_interface.json');
                   fs.writeFileSync(legacyPath, JSON.stringify(configData, null, 2), 'utf-8');
                   
                   // 同时同步更新 Markdown 文件 (事实来源 - 按照连接器分块显示)
                   const mdPath = path.resolve(__dirname, 'device-interfaces/renesas-bms-cabinet-clean.md');
                   let mdContent = "# 瑞萨-BMS功能测试柜 接口定义清单\n\n";
                   
                   // 按连接器分组
                   const groups = configData.reduce((acc: any, pin: any) => {
                     const connector = pin.tags?.[0] || '未分类连接器';
                     if (!acc[connector]) acc[connector] = [];
                     acc[connector].push(pin);
                     return acc;
                   }, {});

                   Object.keys(groups).forEach(connector => {
                     mdContent += `## ${connector}\n`;
                     mdContent += `| 序号 | 针脚 (PIN) | 信号定义 |\n`;
                     mdContent += `| :--- | :--- | :--- |\n`;
                     groups[connector].forEach((pin: any, index: number) => {
                       mdContent += `| ${index + 1} | ${pin.originalPin || '-'} | ${pin.name || '-'} |\n`;
                     });
                     mdContent += `\n`;
                   });
                   
                   fs.writeFileSync(mdPath, mdContent, 'utf-8');
                   console.log(`[API] 以分块格式同步更新 Markdown 文件: ${mdPath}`);
                }

                console.log(`[API] 设备 [${deviceId}] 配置已保存至: ${filePath}`);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: e.message }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
})
