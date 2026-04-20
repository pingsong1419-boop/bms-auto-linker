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
          } else {
            next();
          }
        });
      }
    }
  ],
})
