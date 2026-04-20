import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CABINET_MAPPING_RULES, MATCHING_CONFIG } from '../rules/matchingRules';

export interface PinDefinition {
  id: string;
  name: string;
  originalPin: string;
  type: 'HV' | 'LV' | 'CAN' | 'AI' | 'DI' | 'DO' | 'GND' | 'UNKNOWN';
  tags: string[];
  description?: string;
}

export interface BmsPin extends PinDefinition {
  matchedPinId: string | null;
  shortedTesterPinIds?: string[];
  matchScore: number;
  status: 'UNMATCHED' | 'MATCHED' | 'CONFLICT' | 'MANUAL';
  description?: string;
}

export interface MatchEntry {
  bmsPinId: string;
  testerPinId: string;
  shortedTesterPinIds?: string[];
  score: number;
  reason: string;
}

const semanticKeywords = [
  { key: 'ntc', keywords: ['temp', 'ntc', '温感', '温度', 'th', 'tsns'] },
  { key: 'pwr', keywords: ['power', 'pwr', 'source', '电源', 'kl30', 'kl31'] },
  { key: 'can', keywords: ['can', 'com', '通讯'] },
  { key: 'relay', keywords: ['relay', 'k', '继电器', '短接', 'link', 'connect'] },
  { key: 'wake', keywords: ['wake', 'wak', '唤醒', 'kl15'] }
];

function normalize(name: string): string {
  if (!name) return '';
  // 增加对 "-" 符号的清理，统一视为空
  return name.toLowerCase().replace(/[_\s\-\(\)\/]/g, '').replace(/\+/g, 'plus');
}

function calculateMatchScore(dutName: string, testerName: string): { score: number; reason: string } {
  const sD = normalize(dutName);
  const sT = normalize(testerName);
  
  // 0. 安全截断：如果机柜端名字为空（normalize 后没字母了），严禁匹配
  if (!sT || sT.length === 0) return { score: 0, reason: '' };
  if (!sD || sD.length === 0) return { score: 0, reason: '' };

  // 1. 核心碰撞检测：数字必须一致 (防止 1 连到 3)
  const dNums = dutName.match(/\d+/g) || [];
  const tNums = testerName.match(/\d+/g) || [];
  if (dNums.length > 0 && tNums.length > 0) {
    if (dNums[0] !== tNums[0]) return { score: 0, reason: '数字序号不匹配' };
  }

  // 2. 全字精准匹配
  if (sD === sT) return { score: 1.0, reason: '全字匹配' };

  // 3. 复合定义拆分匹配
  if (testerName.includes('/')) {
    const parts = testerName.split('/').map(p => normalize(p)).filter(p => p.length > 0);
    if (parts.includes(sD)) return { score: 1.0, reason: '复合定义内匹配' };
  }

  // 4. 包含关系匹配
  if (sT.includes(sD) || sD.includes(sT)) return { score: 0.85, reason: '字符包含' };

  // 5. 语义关联匹配
  let semanticScore = 0;
  const lowerD = dutName.toLowerCase();
  const lowerT = testerName.toLowerCase();
  semanticKeywords.forEach(entry => {
    const isDMatch = lowerD.includes(entry.key) || entry.keywords.some(k => lowerD.includes(k));
    const isTMatch = lowerT.includes(entry.key) || entry.keywords.some(k => lowerT.includes(k));
    if (isDMatch && isTMatch) semanticScore = 0.80;
  });

  return semanticScore > 0 ? { score: semanticScore, reason: '语义关联' } : { score: 0, reason: '' };
}

export const useMatcherStore = defineStore('matcher', () => {
  const bmsPins = ref<BmsPin[]>([]);
  const testerPins = ref<PinDefinition[]>([]);
  const isMatching = ref(false);
  const selectedDutPinId = ref<string | null>(null);

  const setIsMatching = (v: boolean) => { isMatching.value = v; };
  const setBmsPins = (p: any[]) => { bmsPins.value = p.map((pin, i) => ({ ...pin, id: pin.id || `bms_${i}`, matchedPinId: null, shortedTesterPinIds: [], matchScore: 0, status: 'UNMATCHED' })); };
  const setTesterPins = (p: PinDefinition[]) => { testerPins.value = p; };
  const clearMatches = () => { bmsPins.value.forEach(p => { p.matchedPinId = null, p.shortedTesterPinIds = [], p.matchScore = 0, p.status = 'UNMATCHED'; }); };

  const matches = computed<MatchEntry[]>(() => {
    return bmsPins.value
      .filter(p => p.matchedPinId || p.shortedTesterPinIds?.length)
      .map(p => ({
        bmsPinId: p.id,
        testerPinId: p.matchedPinId || (p.shortedTesterPinIds?.[0] || ''),
        shortedTesterPinIds: p.shortedTesterPinIds,
        score: p.matchScore,
        reason: p.description || '自动匹配'
      }));
  });

  async function autoMatch() {
    setIsMatching(true);
    await new Promise(r => setTimeout(r, 300));

    // 强化过滤逻辑
    const activeTesterPins = testerPins.value.filter(tp => {
      if (!MATCHING_CONFIG.filterEmptyTesterPins) return true;
      if (!tp.name) return false;
      // 只要 normalize 之后没有有效字符了，就认为是无效针脚
      return normalize(tp.name).length > 0;
    });

    bmsPins.value.forEach(dutPin => {
      // 0. 通用 "&" 并联处理
      const comboSource = (dutPin.description || dutPin.name);
      if (MATCHING_CONFIG.enableUniversalAmpersandParallelMatching && comboSource.includes('&')) {
        const parts = comboSource.split('&').map(p => p.trim()).filter(p => p.length > 0);
        const foundIds: string[] = [];
        parts.forEach(part => {
          const found = activeTesterPins.find(tp => {
            const sn = normalize(tp.name);
            const sp = normalize(part);
            return sn && sp && (sn === sp || sn.includes(sp) || sp.includes(sn));
          });
          if (found && !foundIds.includes(found.id)) foundIds.push(found.id);
        });
        if (foundIds.length > 0) {
          dutPin.matchedPinId = foundIds[0];
          dutPin.shortedTesterPinIds = foundIds.length > 1 ? foundIds : undefined;
          dutPin.matchScore = 1.0;
          dutPin.status = 'MATCHED';
          dutPin.description = `符号并联 [${foundIds.length}路]`;
          return;
        }
      }

      // 1. 硬件强规则
      for (const rule of CABINET_MAPPING_RULES) {
        const m = dutPin.name.match(rule.sourcePattern);
        if (m) {
          const [index, pol] = rule.transform(m);
          const targets: string[] = [];
          rule.targetTemplates.forEach(tpl => {
            const tName = tpl.replace('$1', index).replace('$2', pol);
            const found = activeTesterPins.find(tp => normalize(tp.name) === normalize(tName));
            if (found) targets.push(found.id);
          });
          if (targets.length > 0) {
            dutPin.matchedPinId = targets[0];
            dutPin.shortedTesterPinIds = targets.length > 1 ? targets : undefined;
            dutPin.matchScore = 1.0;
            dutPin.status = 'MATCHED';
            dutPin.description = `强规则 [${index}${pol}]`;
            return;
          }
        }
      }

      // 2. 采样数字强对齐
      if (/^(B|Cell|C)\d+/i.test(dutPin.name)) {
        const dNum = dutPin.name.match(/\d+/);
        if (dNum) {
          const found = activeTesterPins.find(tp => {
            const tNum = tp.name.match(/\d+/);
            return tNum && tNum[0] === dNum[0] && /^(B|V|S|Cell)\d+/i.test(tp.name);
          });
          if (found) {
            dutPin.matchedPinId = found.id;
            dutPin.matchScore = 0.95;
            dutPin.status = 'MATCHED';
            dutPin.description = '单体数字对齐';
            return;
          }
        }
      }

      // 3. 全量匹配扫描
      let best = { id: '', score: 0, reason: '' };
      activeTesterPins.forEach(tp => {
        const result = calculateMatchScore(dutPin.name, tp.name);
        if (result.score > best.score) {
          best = { id: tp.id, score: result.score, reason: result.reason };
        }
      });

      if (best.score >= (MATCHING_CONFIG.minScoreThreshold || 0.4)) {
        dutPin.matchedPinId = best.id;
        dutPin.matchScore = best.score;
        dutPin.status = 'MATCHED';
        dutPin.description = best.reason;
      }
    });

    setIsMatching(false);
  }

  return { bmsPins, testerPins, matches, isMatching, matchedCount: computed(() => bmsPins.value.filter(p => p.status === 'MATCHED' || p.status === 'MANUAL').length), setBmsPins, setTesterPins, setIsMatching, clearMatches, autoMatch, updateManualMatch: (d, t) => {
    const p = bmsPins.value.find(p => p.id === d);
    if (p) { p.matchedPinId = t; p.status = t ? 'MANUAL' : 'UNMATCHED'; }
  }};
});
