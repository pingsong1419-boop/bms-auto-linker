export const MATCHER_VERSION = '1.0';
export type PinType = 'CAN' | 'AI' | 'DI' | 'DO' | 'HV' | 'LV' | 'GND' | 'NTC' | 'UNKNOWN';

export interface PinDefinition {
  id: string;
  name: string;
  originalPin?: string;
  type: PinType;
  tags: string[];
  description?: string;
  voltageRange?: string;
  currentLimit?: string;
  rawRow?: any; // 存储原始 Excel 行数据以便还原格式
}

export interface MatchResult {
  testerPinId: string;
  bmsPinId: string;
  score: number;
  status: 'AUTO' | 'MANUAL' | 'CONFLICT';
  reason?: string;
  shortedTesterPinIds?: string[]; // 用于 V&S 短接等情况，存储所有相关的物理针脚 ID
}

export interface MatcherState {
  testerPins: PinDefinition[];
  bmsPins: PinDefinition[];
  matches: MatchResult[];
  isMatching: boolean;
}
