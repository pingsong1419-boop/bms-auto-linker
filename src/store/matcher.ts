import { defineStore } from 'pinia';
import type { PinDefinition, MatchResult } from '../types/matcher';
import { CABINET_MAPPING_RULES } from '../rules/matchingRules';

export const useMatcherStore = defineStore('matcher', {
  state: () => ({
    testerPins: [] as PinDefinition[],
    bmsPins: [] as PinDefinition[],
    matches: [] as MatchResult[],
    isMatching: false,
  }),

  actions: {
    setTesterPins(pins: PinDefinition[]) {
      this.testerPins = pins;
    },

    setBmsPins(pins: PinDefinition[]) {
      this.bmsPins = pins;
    },

    /**
     * 智能语义匹配核心算法 (已优化支持强制物理规则)
     */
    async autoMatch() {
      this.isMatching = true;
      this.matches = [];
      
      await new Promise(resolve => setTimeout(resolve, 800));

      const newMatches: MatchResult[] = [];
      const usedTesterPinIds = new Set<string>();
      const usedBmsPinIds = new Set<string>();
      
      // 信号名到已匹配针脚 ID 的缓存，用于实现“同名同锁”
      const signalNameMatchCache = new Map<string, string>();

      // 1. 优先执行“物理强规则” (如 V+S 匹配)
      for (const bPin of this.bmsPins) {
        if (!bPin.name || bPin.name.trim() === '' || bPin.name === '-') continue;

        for (const rule of CABINET_MAPPING_RULES) {
          const match = bPin.name.match(rule.sourcePattern);
          if (match) {
            const [index, polarity] = rule.transform(match);
            
            // 构建需要寻找的目标信号列表 (如 V1-, S1-)
            const targets = rule.targetTemplates.map(t => 
              t.replace('$1', index).replace('$2', polarity === '+' ? '+' : '-')
            );

            const foundTesterPins = this.testerPins.filter(tp => 
              targets.some(target => tp.name.toUpperCase() === target.toUpperCase()) &&
              !usedTesterPinIds.has(tp.id)
            );

            // 如果找到了匹配物理规则的针脚
            if (foundTesterPins.length > 0) {
              const mainPinId = foundTesterPins[0].id;
              newMatches.push({
                testerPinId: mainPinId,
                bmsPinId: bPin.id,
                score: 1.0,
                status: 'AUTO',
                reason: `[强规则] ${rule.name}`,
                shortedTesterPinIds: foundTesterPins.map(p => p.id) // 存储所有短接针脚
              });
              
              foundTesterPins.forEach(tp => usedTesterPinIds.add(tp.id));
              usedBmsPinIds.add(bPin.id);

              // 同步到同名缓存
              signalNameMatchCache.set(bPin.name, mainPinId);
            }
          }
        }
      }

      // 2. 执行常规模糊匹配
      const semanticKeywords = [
        { key: '高边', keywords: ['hsd', 'highside', 'condrv'] },
        { key: '低边', keywords: ['lsd', 'lowside'] },
        { key: '驱动', keywords: ['output', 'drv', '驱动'] },
        { key: '温感', keywords: ['ntc', 'temp', '温感', '热敏'] },
        { key: '短接', keywords: ['短接', 'jump', 'link', '转接'] },
        { key: '转接', keywords: ['短接', '转接', 'link'] },
        { key: '电源', keywords: ['power', 'vcc', 'pwr', 'kl30', 'kl31'] },
        { key: '万用表', keywords: ['dmm', 'multimeter', '万用表'] },
        { key: '唤醒', keywords: ['wake', '唤醒'] },
        { key: 'CAN', keywords: ['canh', 'canl', 'can'] },
      ];

      const normalize = (str: string) => {
        if (!str) return '';
        return str.toLowerCase()
          .replace(/[\s\-_]/g, '')
          .replace(/\+/g, 'plus')
          .replace(/\-/g, 'minus');
      };

      for (const bPin of this.bmsPins) {
        if (usedBmsPinIds.has(bPin.id)) continue;

        // 强制规则：如果没有信号名称（中文释义为空），则不参与任何匹配
        if (!bPin.name || bPin.name.trim() === '' || bPin.name === '-') {
          continue;
        }

        // 强规则：如果这个信号名之前已经匹配过了，直接复用同一个物理针脚
        if (signalNameMatchCache.has(bPin.name)) {
          const reusedTesterPinId = signalNameMatchCache.get(bPin.name)!;
          
          // 查找原始匹配以获取可能存在的短接列表
          const originalMatch = newMatches.find(m => m.testerPinId === reusedTesterPinId);

          newMatches.push({
            testerPinId: reusedTesterPinId,
            bmsPinId: bPin.id,
            score: 1.0,
            status: 'AUTO',
            reason: `复用同名信号匹配 (${bPin.name})`,
            shortedTesterPinIds: originalMatch?.shortedTesterPinIds
          });
          usedBmsPinIds.add(bPin.id);
          continue;
        }

        let bestMatch: { id: string; score: number; reason: string } | null = null;
        const sB = normalize(bPin.name);

        for (const tPin of this.testerPins) {
          // 只有在没被复用规则选中的情况下，才检查针脚是否被占用
          if (usedTesterPinIds.has(tPin.id)) continue;

          let score = 0;
          let reason = '';

          const sT = normalize(tPin.name);

          // 1. 完全匹配
          if (sT === sB) {
            score = 100;
            reason = '完全匹配';
          } 
          // 2. 包含匹配
          else if (sT.includes(sB) || sB.includes(sT)) {
            score = 90;
            reason = '字符包含匹配';
          }
          // 3. 语义关键字匹配
          else {
            let semanticHit = 0;
            semanticKeywords.forEach(entry => {
              const bmsContent = (bPin.name + (bPin.description || '')).toLowerCase();
              if (bmsContent.includes(entry.key)) {
                entry.keywords.forEach(kw => {
                  if (sT.includes(kw)) semanticHit += 45;
                });
              }
            });
            
            if (semanticHit > 0) {
              score = Math.min(semanticHit, 95);
              reason = '中文语义关联匹配';
            }
          }

          if (score > (bestMatch?.score || 0)) {
            bestMatch = { id: tPin.id, score, reason };
          }
        }

        if (bestMatch && bestMatch.score > 40) {
          newMatches.push({
            testerPinId: bestMatch.id,
            bmsPinId: bPin.id,
            score: bestMatch.score / 100,
            status: 'AUTO',
            reason: bestMatch.reason
          });
          usedTesterPinIds.add(bestMatch.id);
          usedBmsPinIds.add(bPin.id);
          // 记录此信号名称对应的物理针脚，供后续同名信号复用
          signalNameMatchCache.set(bPin.name, bestMatch.id);
        }
      }

      this.matches = newMatches;
      this.isMatching = false;
    },

    clearMatches() {
      this.matches = [];
    },

    manualUpdateMatch(testerPinId: string, bmsPinId: string | null) {
      // 移除旧匹配
      this.matches = this.matches.filter(m => m.testerPinId !== testerPinId && m.bmsPinId !== bmsPinId);
      
      // 添加新匹配
      if (bmsPinId) {
        this.matches.push({
          testerPinId,
          bmsPinId,
          score: 1.0,
          status: 'MANUAL',
          reason: '人工校准'
        });
      }
    }
  }
});
