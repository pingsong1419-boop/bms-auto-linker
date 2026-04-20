const fs = require('fs');
const path = require('path');

const mdPath = 'c:\\Users\\95403\\.gemini\\antigravity\\scratch\\bms-auto-linker\\device-interfaces\\renesas-bms-cabinet-clean.md';
const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// --- 2# 120PIN 定义 (保持之前的正确) ---
const special2No120 = {};
for(let i=0; i<11; i++) { special2No120[letters[i*2]] = `万用表${13+i}+`; special2No120[letters[i*2+1]] = `万用表${13+i}-`; }
const aa_al = ['AA','AB','AC','AD','AE','AF','AH','AJ','AK','AL'];
for(let i=0; i<5; i++) { special2No120[aa_al[i*2]] = `万用表${24+i}+`; special2No120[aa_al[i*2+1]] = `万用表${24+i}-`; }
const am_az = ['AM','AN','AP','AR','AS','AT','AU','AV','AW','AX','AY','AZ'];
for(let i=0; i<6; i++) { special2No120[am_az[i*2]] = `从机NTC${1+i}+`; special2No120[am_az[i*2+1]] = `从机NTC${1+i}-`; }
for(let i=0; i<11; i++) { special2No120['B'+letters[i*2]] = `从机NTC${7+i}+`; special2No120['B'+letters[i*2+1]] = `从机NTC${7+i}-`; }
for(let i=0; i<11; i++) { special2No120['C'+letters[i*2]] = `从机NTC${18+i}+`; special2No120['C'+letters[i*2+1]] = `从机NTC${18+i}-`; }
const da_dn = ['DA','DB','DC','DD','DE','DF','DH','DJ','DK','DL','DM','DN'];
for(let i=0; i<6; i++) { special2No120[da_dn[i*2]] = `${29+i}#万用表+`; special2No120[da_dn[i*2+1]] = `${29+i}#万用表-`; }
special2No120['DP'] = 'PLC输出6'; special2No120['DR'] = 'PLC输出7'; special2No120['DS'] = 'PLC输入1'; special2No120['DT'] = 'PLC输入2';
special2No120['DU'] = 'PLC输入3'; special2No120['DV'] = 'PLC输入4'; special2No120['DW'] = 'PLC输入5'; special2No120['DX'] = 'PLC输出1';
special2No120['DY'] = 'PLC输出2'; special2No120['DZ'] = 'PLC输出3'; special2No120['EA'] = 'PLC输出4'; special2No120['EB'] = '24V-';
special2No120['EC'] = '24V+'; special2No120['ED'] = '485+'; special2No120['EE'] = '485-'; special2No120['EF'] = 'POWER+';
special2No120['EH'] = 'WAKE1'; special2No120['EJ'] = 'POWER1-'; special2No120['EK'] = 'INCANH'; special2No120['EL'] = 'INCANL';

// --- 1# 90PIN 专项定义 (根据最新 90PIN 截图) ---
const special1No90 = {};
special1No90['C'] = 'PE';
const hv_pins = ['D','E','F','H','J','K','L','M','N','P','R','S','T','U','V','W'];
const hv_sigs = ['高压源1+','高压源1-','高压源2+','高压源2-','高压源3+','高压源3-','高压源4+','高压源4-','高压源5+','高压源5-','高压源6+','高压源6-','高压源7+','高压源8+','高压源9+','高压源10-'];
hv_pins.forEach((p, i) => special1No90[p] = hv_sigs[i]);

const pwm_check = ['X','Y','Z','AA','AB','AC','AD','AE'];
pwm_check.forEach((p, i) => special1No90[p] = `PWM板卡检测${Math.floor(i/2)+1}${i%2===0?'+':'-'}`);

const pwm_out = ['AF','AH','AJ','AK','AL','AM','AN','AP'];
pwm_out.forEach((p, i) => special1No90[p] = `PWM板卡输出${Math.floor(i/2)+1}${i%2===0?'+':'-'}`);

const short_1_5 = ['AR','AS','AT','AU','AV','AW','AX','AY','AZ','BA'];
short_1_5.forEach((p, i) => special1No90[p] = `短接${Math.floor(i/2)+1}${i%2===0?'+':'-'}`);

const short_6 = ['BB','BC'];
special1No90['BB'] = '短接6+'; special1No90['BC'] = '短接6-';

for(let i=1; i<=8; i++) special1No90[['BD','BE','BF','BH','BJ','BK','BL','BM'][i-1]] = `HSD_OUTPUT${i}/高边驱动${i}`;
for(let i=1; i<=6; i++) special1No90[['BN','BP','BR','BS','BT','BU'][i-1]] = `LSD_OUTPUT${i}/低边驱动${i}`;
for(let i=1; i<=5; i++) special1No90[['BV','BW','BX','BY','BZ'][i-1]] = `PLC输入${i}`;

special1No90['CA'] = 'PLC输出1';
special1No90['CB'] = 'PLC输出2';
special1No90['CC'] = 'PLC输出3';
special1No90['CD'] = 'PLC输出4';
special1No90['CE'] = '24V-';
special1No90['CF'] = '24V+';
special1No90['CH'] = '485+';
special1No90['CJ'] = '485-';
special1No90['CK'] = '机柜内部短接7+';
special1No90['CL'] = '机柜内部短接7-';
special1No90['CM'] = '机柜内部短接8+';
special1No90['CN'] = '机柜内部短接8-';
special1No90['CP'] = 'PLC输出5';
special1No90['CR'] = 'PLC输出6';
special1No90['CS'] = 'PLC输出7';
special1No90['CT'] = '机柜内部短接9+';
special1No90['CU'] = '机柜内部短接9-';
special1No90['CV'] = '机柜内部短接10+';
special1No90['CW'] = '机柜内部短接10-';

// --- 模板助手 ---
function generate120PinTemplate() {
    const list = [];
    ['', 'A', 'B', 'C', 'D'].forEach(prefix => letters.forEach(l => list.push(prefix + l)));
    ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'J', 'K', 'L'].forEach(l => list.push('E' + l));
    return list;
}

function generate90PinTemplate() {
    const list = [];
    ['', 'A', 'B', 'C'].forEach(prefix => letters.forEach(l => list.push(prefix + l)));
    list.push('DA', 'DB');
    return list;
}

function generate56PinTemplate() {
    const list = [];
    letters.forEach(l => list.push(l));
    ['a','b','c','d','e','f','h','j','k','l','m','n','p','r','s','t','u','v','w','x','y','z'].forEach(l => list.push(l));
    ['AA','BB','CC','DD','EE','FF','HH','JJ','KK','LL','MM','NN'].forEach(l => list.push(l));
    return list;
}

const templates = {
    '1#120pin连接器': generate120PinTemplate(),
    '2#120pin连接器': generate120PinTemplate(),
    '3#120pin连接器': generate120PinTemplate(),
    '1#90pin连接器': generate90PinTemplate(),
    '2#90pin连接器': generate90PinTemplate(),
    '56pin连接器': generate56PinTemplate()
};

// 保留其它定义
const content = fs.readFileSync(mdPath, 'utf8');
const linesArr = content.split('\n');
const existingMap = {};
let currentC = '';
linesArr.forEach(line => {
    const h = line.match(/^##\s+(.+)/);
    if (h) currentC = h[1].trim();
    const r = line.match(/^\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    if (r && currentC !== '2#120pin连接器' && currentC !== '1#90pin连接器') {
        const pin = r[1].trim(); const sig = r[2].trim();
        if (sig !== '-' && sig !== '未分配') existingMap[`${currentC}_${pin}`] = sig;
    }
});

// 强制更新专项定义
Object.keys(special2No120).forEach(pin => existingMap[`2#120pin连接器_${pin}`] = special2No120[pin]);
Object.keys(special1No90).forEach(pin => existingMap[`1#90pin连接器_${pin}`] = special1No90[pin]);

let newMd = "# 瑞萨-BMS功能测试柜 接口定义清单 (已对齐 1#90PIN 与 2#120PIN)\n\n";
Object.keys(templates).forEach(connector => {
    newMd += `## ${connector}\n| 序号 | 针脚 (PIN) | 信号定义 |\n| :--- | :--- | :--- |\n`;
    templates[connector].forEach((pin, idx) => {
        newMd += `| ${idx + 1} | ${pin} | ${existingMap[`${connector}_${pin}`] || '-'} |\n`;
    });
    newMd += `\n`;
});

fs.writeFileSync(mdPath, newMd, 'utf8');
console.log("1#90pin definitive map complete!");
