import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';

const filePath = "C:\\Users\\95403\\Desktop\\瑞萨\\瑞萨-BMS功能测试柜接口定义表.xlsx";

async function inspectExcel() {
  try {
    const fileBuffer = await readFile(filePath);
    const workbook = XLSX.read(fileBuffer);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log("Sheet Name:", firstSheetName);
    console.log("Top 5 Rows:");
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
  } catch (error) {
    console.error("Error reading Excel:", error);
  }
}

inspectExcel();
