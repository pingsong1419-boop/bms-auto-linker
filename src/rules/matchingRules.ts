/**
 * 接口匹配强制物理规则定义
 */

export interface GroupRule {
    name: string;
    description: string;
    // 匹配源信号的正则表达式 (BMS端)
    sourcePattern: RegExp;
    // 需要在机柜端寻找的目标信号模板
    targetTemplates: string[];
    // 信号极性或索引的提取逻辑
    transform: (match: RegExpMatchArray) => string[];
}

export const CABINET_MAPPING_RULES: GroupRule[] = [
    {
        name: 'V&S 强制短接规则',
        description: '瑞萨电池柜的 V (Voltage) 和 S (Sense) 必须成对出现，短接后形成 BMS 的 B 信号',
        // 匹配 B1-, B1+, B12-, B12+, 或 Cell_01_V (视为 B1+)
        sourcePattern: /^(?:B|Cell_?)(\d+)([+-]?)/i,
        targetTemplates: ['V$1$2', 'S$1$2'],
        transform: (match) => {
            const index = match[1];
            const polarity = match[2] || '+'; // 默认正极
            return [index, polarity];
        }
    }
];
