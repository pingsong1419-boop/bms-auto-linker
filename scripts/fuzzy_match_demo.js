import fs from 'fs';
import path from 'path';

const cabinetJsonPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\src\\assets\\devices\\renesas-bms-cabinet.json';

const semanticKeywords = [
    { key: '高边', keywords: ['hsd', 'highside'] },
    { key: '低边', keywords: ['lsd', 'lowside'] },
    { key: '驱动', keywords: ['output', 'drv', '驱动'] },
    { key: '温感', keywords: ['ntc', 'temp', '温感'] },
    { key: '短接', keywords: ['短接', 'jump', 'link'] },
    { key: '转接', keywords: ['短接', '转接', 'link'] },
    { key: '电源', keywords: ['power', 'vcc', 'pwr'] },
    { key: '万用表', keywords: ['dmm', 'multimeter', '万用表'] },
];

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[\s\-_]/g, '').replace(/\+/g, 'plus').replace(/\-/g, 'minus');
}

function getMatchScore(source, target) {
    const s = normalize(source);
    const t = normalize(target);

    if (s === t) return 100;
    if (t.includes(s) || s.includes(t)) return 90;

    let semanticScore = 0;
    semanticKeywords.forEach(entry => {
        if (source.includes(entry.key)) {
            entry.keywords.forEach(kw => {
                if (t.includes(kw)) semanticScore += 40;
            });
        }
    });

    return Math.min(semanticScore, 95);
}

function findBestMatch(signalName, cabinetPins) {
    let best = null;
    let maxScore = 0;

    cabinetPins.forEach(pin => {
        const score = getMatchScore(signalName, pin.name);
        if (score > maxScore) {
            maxScore = score;
            best = pin;
        }
    });

    return maxScore > 30 ? { pin: best, score: maxScore } : null;
}

try {
    const pins = JSON.parse(fs.readFileSync(cabinetJsonPath));

    const inputs = [
        "POWER+",
        "PWOER1-", // 拼写错误测试
        "WAKE1",
        "高边驱动",
        "机柜内部转接1+",
        "温感1",
        "万用表8+"
    ];

    console.log("信号模糊匹配结果:\n");
    console.log("| 输入信号 | 最优匹配项 | 脚位 | 连接器 | 匹配分 |");
    console.log("| :--- | :--- | :--- | :--- | :--- |");

    inputs.forEach(input => {
        const result = findBestMatch(input, pins);
        if (result) {
            console.log(`| ${input} | ${result.pin.name} | ${result.pin.originalPin} | ${result.pin.tags[0]} | ${result.score} |`);
        } else {
            console.log(`| ${input} | 无 | - | - | 0 |`);
        }
    });

} catch (e) {
    console.error(e.message);
}
