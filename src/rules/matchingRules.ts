/**
 * 接口匹配强制物理规则定义
 */

export interface GroupRule {
    name: string;
    description: string;
    sourcePattern: RegExp;
    targetTemplates: string[];
    transform: (match: RegExpMatchArray) => string[];
}

// 全局匹配偏好设置 (核心逻辑控制台)
export const MATCHING_CONFIG = {
    // 【逻辑 A】强制过滤：当机柜针脚没有中文解释（解释为空、仅有 - 或 /）时，禁止参与任何匹配
    filterEmptyTesterPins: true,
    
    // 【逻辑 B】符号并联：只要 BMS 描述中出现 &，自动拆分并寻找多个机柜针脚并联
    enableUniversalAmpersandParallelMatching: true,
    
    // 【逻辑 C】序号对齐：如果信号名中包含数字，匹配时双方数字必须严格一致 (防止 LINK1 连到 短接3)
    requireIndexEquality: true,
    
    // 【逻辑 D】电池专用强匹配：只要 Cell/B 信号数字一致且机柜端也是电压类，给与 0.95 高分
    enableCellDigitalFingerprint: true,

    // 评分阈值：低于 0.4 的匹配将被视为无效
    minScoreThreshold: 0.4
};

export const CABINET_MAPPING_RULES: GroupRule[] = [
    {
        name: '单体采样并联规则',
        description: '匹配 Bx/Cell_x 到机柜端的 Bx/Vx/Sx 两个通道',
        sourcePattern: /^(?:B|Cell|C)(\d+)([+-]?)/i,
        targetTemplates: ['V$1$2', 'S$1$2', 'B$1$2'],
        transform: (match) => {
            return [match[1], match[2] || '+'];
        }
    },
    {
        name: '通用并联准则',
        description: '响应 BMS 定义中的 "&" 符号实现多点自动并接',
        sourcePattern: /&/, 
        targetTemplates: [], 
        transform: () => []
    }
];
