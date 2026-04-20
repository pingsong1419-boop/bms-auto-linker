<script setup lang="ts">
import { ref, onMounted, toRaw } from 'vue';
import { useMatcherStore } from './store/matcher';
import { 
  Zap, 
  Cpu, 
  ArrowRightLeft, 
  Upload, 
  CheckCircle2, 
  History,
  Settings2,
  Share2,
  Trash2
} from 'lucide-vue-next';

import * as XLSX from 'xlsx';
import testerData from './assets/tester_interface.json';
import type { PinType } from './types/matcher';

const store = useMatcherStore();
const activeStep = ref(1);
const bmsFileInput = ref<HTMLInputElement | null>(null);
const bmsHeaders = ref<string[]>(['连接器', '脚位', '信号定义', '功能描述']);

onMounted(() => {
  const filteredTesterPins = (testerData as any[]).filter(p => p.originalPin !== '脚位');
  store.setTesterPins(filteredTesterPins);

  store.setBmsPins([
    { id: 'b1', name: 'POWER+', type: 'UNKNOWN' as PinType, tags: ['CON8'], description: '主电源正极 (Pin 2, 18)', rawRow: { '连接器': 'CON8', '脚位': '2, 18', '信号定义': 'POWER+', '功能描述': '主电源正极' } },
    { id: 'b2', name: 'PWOER1-', type: 'UNKNOWN' as PinType, tags: ['CON8'], description: '主电源负极 (Pin 1, 17)', rawRow: { '连接器': 'CON8', '脚位': '1, 17', '信号定义': 'PWOER1-', '功能描述': '主电源负极' } },
    { id: 'b3', name: 'WAKE1', type: 'UNKNOWN' as PinType, tags: ['CON8'], description: '唤醒信号 1 (Pin 19)', rawRow: { '连接器': 'CON8', '脚位': '19', '信号定义': 'WAKE1', '功能描述': '唤醒信号 1' } },
    { id: 'b5', name: 'B1+', type: 'UNKNOWN' as PinType, tags: ['CELL'], description: '电芯1正极采样 (需要V1+/S1+)', rawRow: { '连接器': 'CELL', '脚位': 'A1', '信号定义': 'B1+', '功能描述': '电芯1正极采样' } },
  ]);
});

const triggerBmsImport = () => {
  bmsFileInput.value?.click();
};

const handleBmsImport = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target?.result;
    const workbook = XLSX.read(data, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (json.length > 0) {
      bmsHeaders.value = Object.keys(json[0]);
    }

    const newBmsPins = json.map((row, index) => {
      const nameKey = Object.keys(row).find(key => 
        ['信号', '名称', 'name', 'signal', 'definition'].some(k => key.toLowerCase().includes(k))
      ) || Object.keys(row)[0];

      return {
        id: `bms_imported_${index}`,
        name: String(row[nameKey] || ''),
        type: 'UNKNOWN' as PinType,
        tags: [String(row[Object.keys(row)[0]] || 'DUT')],
        description: '',
        rawRow: row 
      };
    });

    store.setBmsPins(newBmsPins);
    activeStep.value = 1;
    store.clearMatches();
  };
  reader.readAsBinaryString(file);
};

const handleAutoMatch = async () => {
  await store.autoMatch();
  activeStep.value = 2;
};

const isExporting = ref(false);

const handleExportExcel = async () => {
  if (store.bmsPins.length === 0 || isExporting.value) return;

  let fileHandle: any = null;
  const fileName = `BMS_接线方案报告_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`;

  try {
    if ('showSaveFilePicker' in window) {
      fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Excel 电子表格',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
        }]
      });
    }
  } catch (e) {
    return;
  }

  isExporting.value = true;
  
  const payload = {
    filename: bmsFileInput.value?.files?.[0]?.name || 'BMS_Report.xlsx',
    pins: store.bmsPins.map(pin => {
      const match = getMatch(pin.id, 'bms');
      return {
        name: pin.name,
        rawRow: JSON.parse(JSON.stringify(pin.rawRow)), // 深克隆还原标准对象
        match: match ? {
          score: match.score,
          display_pin: getMatchDisplayPin(pin.id),
          display_conn: getMatchDisplayConnector(pin.id),
          reason: match.reason
        } : null
      };
    })
  };

  try {
    const response = await fetch('/api/export-python', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '导出失败');
    }

    const blob = await response.blob();

    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      alert(`✅ 导出成功！文件已保存至您选择的位置。`);
    } else {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      alert(`✅ 导出成功！已开始自动下载。`);
    }
  } catch (e: any) {
    alert(`❌ 导出失败：${e.message}`);
  } finally {
    isExporting.value = false;
  }
};

const getMatch = (id: string, side: 'tester' | 'bms' = 'tester') => {
  if (side === 'tester') return store.matches.find(m => m.testerPinId === id);
  return store.matches.find(m => m.bmsPinId === id);
};

const getBmsPinById = (id: string) => {
  return store.bmsPins.find(p => p.id === id);
};

const getTesterPin = (id: string) => {
  return store.testerPins.find(p => p.id === id);
};

const getMatchDisplayPin = (id: string) => {
  const match = getMatch(id, 'bms');
  if (!match) return '-';
  if (match.shortedTesterPinIds && match.shortedTesterPinIds.length > 0) {
    return match.shortedTesterPinIds
      .map(tid => getTesterPin(tid)?.originalPin || '?')
      .join(' & ');
  }
  return getTesterPin(match.testerPinId)?.originalPin || '-';
};

const getMatchDisplayConnector = (id: string) => {
  const match = getMatch(id, 'bms');
  if (!match) return '-';
  if (match.shortedTesterPinIds && match.shortedTesterPinIds.length > 0) {
    const connectors = match.shortedTesterPinIds
      .map(tid => getTesterPin(tid)?.tags[0] || '?');
    return [...new Set(connectors)].join(' & ');
  }
  return getTesterPin(match.testerPinId)?.tags[0] || '-';
};
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-purple-500/30">
    <header class="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-50">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Zap class="w-6 h-6 text-white fill-white" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            BMS 测试设备智能接口匹配软件
          </h1>
          <p class="text-[10px] text-slate-500 font-medium uppercase tracking-widest">智能接口匹配模型 v1.0</p>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button 
          @click="handleExportExcel"
          :disabled="isExporting"
          class="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 group"
        >
          <div v-if="isExporting" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          <Share2 v-else class="w-4 h-4 group-hover:rotate-12 transition-transform" /> 
          {{ isExporting ? '正在生成报表...' : '导出接线表' }}
        </button>
      </div>
    </header>

    <main class="p-8 max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
      <aside class="col-span-3 space-y-6">
        <div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 class="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-300">
            <Upload class="w-4 h-4 text-purple-400" /> 数据导入
          </h2>
          <div class="space-y-3">
            <input type="file" ref="bmsFileInput" class="hidden" accept=".xlsx,.xls,.csv" @change="handleBmsImport" />
            <button @click="triggerBmsImport" class="w-full py-2 px-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-left flex items-center justify-between transition-all group text-purple-200">
               导入被测 BMS 引脚表 <span class="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[8px]">XLXS / CSV</span>
            </button>
          </div>
        </div>

        <div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 class="text-sm font-semibold mb-4 text-slate-300">匹配控制</h2>
          <button @click="handleAutoMatch" :disabled="store.isMatching" class="w-full py-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl font-bold text-white shadow-xl shadow-purple-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
             {{ store.isMatching ? '正在智能计算...' : '开始执行智能匹配' }}
          </button>
        </div>
      </aside>

      <section class="col-span-9 space-y-6">
        <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 relative overflow-hidden min-h-[600px]">
          <div class="overflow-y-auto max-h-[60vh] rounded-2xl border border-slate-800 bg-slate-900/40">
            <table class="w-full text-left border-collapse">
              <thead class="sticky top-0 bg-slate-900">
                <tr class="bg-slate-800/60 border-b border-slate-800 text-[10px] uppercase text-slate-500 font-bold tracking-widest">
                  <th v-for="header in bmsHeaders" :key="header" class="px-6 py-4">{{ header }}</th>
                  <th class="px-6 py-4">匹配状态</th>
                  <th class="px-6 py-4">EDAC 连接器</th>
                  <th class="px-6 py-4">EDAC 脚位</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                <tr v-for="pin in store.bmsPins" :key="pin.id" class="group hover:bg-slate-800/30 text-xs">
                  <td v-for="header in bmsHeaders" :key="header" class="px-6 py-4 text-slate-300">{{ pin.rawRow?.[header] || '-' }}</td>
                  <td class="px-6 py-4">
                    <div v-if="getMatch(pin.id, 'bms')" class="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 class="w-3 h-3" /> {{ ((getMatch(pin.id, 'bms')?.score || 0) * 100).toFixed(0) }}%
                    </div>
                    <span v-else class="text-slate-600">未匹配</span>
                  </td>
                  <td class="px-6 py-4 font-bold text-slate-200">{{ getMatchDisplayConnector(pin.id) }}</td>
                  <td class="px-6 py-4"><span class="px-2 py-1 bg-purple-600 rounded text-white font-mono">{{ getMatchDisplayPin(pin.id) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <Transition name="slide-up">
            <div v-if="activeStep === 2" class="absolute inset-x-0 bottom-0 py-4 bg-purple-600/20 border-t border-purple-500/30 flex items-center justify-center gap-3 backdrop-blur-xl">
              <CheckCircle2 class="w-5 h-5 text-purple-400" />
              <span class="text-xs font-bold text-purple-200">自动智能匹配完成！</span>
              <button @click="handleExportExcel" :disabled="isExporting" class="ml-8 text-[10px] font-bold text-purple-400 hover:text-white underline underline-offset-4 disabled:opacity-50">
                {{ isExporting ? '正在生成报表...' : '查看并导出接线报告' }}
              </button>
            </div>
          </Transition>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.4s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>
