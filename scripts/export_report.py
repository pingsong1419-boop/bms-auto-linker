import sys
import os
import json
import pandas as pd
import re
from difflib import SequenceMatcher

def normalize(s):
    if not s or pd.isna(s): return ""
    s = str(s).lower()
    s = re.sub(r'[\s\-_]', '', s)
    s = s.replace('+', 'plus').replace('-', 'minus')
    return s

def get_semantic_score(name, target_name):
    s_name = normalize(name)
    s_target = normalize(target_name)
    
    if s_name == s_target: return 100
    if s_name in s_target or s_target in s_name: return 90
    
    # Keyword logic
    keywords = [
        ('高边', ['hsd', 'highside', 'condrv']),
        ('低边', ['lsd', 'lowside']),
        ('驱动', ['output', 'drv', '驱动']),
        ('温感', ['ntc', 'temp', '温感', '热敏']),
        ('短接', ['短接', 'jump', 'link', '转接']),
        ('电源', ['power', 'vcc', 'pwr', 'kl30', 'kl31']),
        ('万用表', ['dmm', 'multimeter', '万用表']),
        ('唤醒', ['wake', '唤醒']),
        ('can', ['canh', 'canl', 'can']),
    ]
    
    score = 0
    name_lower = str(name).lower()
    target_lower = str(target_name).lower()
    
    for cn_key, en_kws in keywords:
        if cn_key in name_lower:
            for kw in en_kws:
                if kw in target_lower:
                    score += 45
    
    return min(score, 95)

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("bms_path", nargs="?", help="Path to BMS Excel file")
    parser.add_argument("--json", help="Matched JSON data string", type=str)
    args = parser.parse_args()

    tester_json_path = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "tester_interface.json")
    with open(tester_json_path, 'r', encoding='utf-8') as f:
        tester_pins = json.load(f)

    # 如果是从 JSON 数据驱动（由前端通过 API 调用）
    if args.json:
        try:
            # 兼容性修复：检查 args.json 是 JSON 字符串还是文件名
            json_content = args.json
            if os.path.exists(args.json):
                with open(args.json, 'r', encoding='utf-8') as f:
                    json_content = f.read()
            
            input_data = json.loads(json_content)
            bms_pins = input_data.get('pins', [])
            original_filename = input_data.get('filename', 'BMS_Report.xlsx')
            
            if not bms_pins:
                print("Error: No pins in JSON data")
                return

            # 由于是 JSON 驱动，我们直接构造结果
            rows = []
            for pin in bms_pins:
                # 深度展开 rawRow
                row_data = pin.get('rawRow', {})
                if not isinstance(row_data, dict): row_data = {}
                else: row_data = row_data.copy()

                # 如果没有原始定义，至少保住信号名称
                if not row_data and pin.get('name'):
                    row_data['信号定义'] = pin.get('name')

                match = pin.get('match')
                if match:
                    row_data['[结果] 匹配状态'] = f"{int(match.get('score', 0) * 100)}%"
                    row_data['[结果] EDAC连接器'] = match.get('display_conn', '-')
                    row_data['[结果] EDAC脚位'] = match.get('display_pin', '-')
                    row_data['[结果] 匹配逻辑'] = match.get('reason', '-')
                else:
                    is_ignored = not pin.get('name') or pin.get('name') == '-' or pin.get('name') == ''
                    row_data['[结果] 匹配状态'] = '已忽略' if is_ignored else '未匹配'
                    row_data['[结果] EDAC连接器'] = '-'
                    row_data['[结果] EDAC脚位'] = '-'
                    row_data['[结果] 匹配逻辑'] = '-'
                
                rows.append(row_data)
            
            df_output = pd.DataFrame(rows)
            # 确保列的顺序：原始列在前，结果列在后
            all_cols = list(df_output.columns)
            res_cols = [c for c in all_cols if c.startswith('[结果]')]
            orig_cols = [c for c in all_cols if not c.startswith('[结果]')]
            df_output = df_output[orig_cols + res_cols]

            output_path = os.path.join(os.getcwd(), f"AUTO_MATCH_EXPORT.xlsx")
            
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                df_output.to_excel(writer, index=False, sheet_name='接线匹配方案')
                # Auto-adjust columns
                worksheet = writer.sheets['接线匹配方案']
                for col in worksheet.columns:
                    max_length = 0
                    column = col[0].column_letter
                    for cell in col:
                        if cell.value: max_length = max(max_length, len(str(cell.value)))
                    worksheet.column_dimensions[column].width = min((max_length + 2) * 1.2, 50)
            
            # 重要：打印绝对路径供 Node 读取
            print(f"EXPORT_SUCCESS:{os.path.abspath(output_path)}")
            return
        except Exception as e:
            # 这里的打印会被 Node 捕获并作为错误返回给前端
            print(f"PYTHON_ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            return

    # 原始 Excel 路径模式
    bms_path = args.bms_path
    if not bms_path:
        print("Error: No input path or JSON provided")
        return

    try:
        df_bms = pd.read_excel(bms_path)
    except Exception as e:
        print(f"Error reading BMS file: {e}")
        return

    # Identify signal name column
    name_col = None
    cols_to_check = ['信号', '名称', 'name', 'signal', 'definition', '信号定义']
    for col in df_bms.columns:
        if any(k in str(col).lower() for k in cols_to_check):
            name_col = col
            break
    if not name_col: name_col = df_bms.columns[0]

    results = [None] * len(df_bms)
    used_tester_ids = set()
    signal_cache = {} # name -> result_dict

    # 1. Force Rules (V&S)
    for i, row in df_bms.iterrows():
        name = str(row[name_col])
        if not name or name == 'nan' or name.strip() == '' or name == '-':
            continue
            
        match = re.search(r'B(\d+)([\+\-])', name, re.I)
        if match:
            num = match.group(1)
            pol = match.group(2)
            targets = [f"V{num}{pol}", f"S{num}{pol}"]
            
            found = [tp for tp in tester_pins if tp['name'].upper() in [t.upper() for t in targets] and tp['id'] not in used_tester_ids]
            
            if found:
                main_tp = found[0]
                shorted_pins = " & ".join([tp['originalPin'] for tp in found])
                shorted_conns = " & ".join(list(dict.fromkeys([tp['tags'][0] for tp in found])))
                
                res = {
                    "match": True,
                    "tester_id": main_tp['id'],
                    "display_pin": shorted_pins,
                    "display_conn": shorted_conns,
                    "reason": f"[强规则] V&S 强制短接"
                }
                signal_cache[name] = res
                results[i] = res
                for tp in found: used_tester_ids.add(tp['id'])

    # 2. Semantic & Cache
    for i, row in df_bms.iterrows():
        if results[i] is not None: continue
        
        name = str(row[name_col])
        if not name or name == 'nan' or name.strip() == '' or name == '-':
            results[i] = {"match": False, "reason": "已忽略"}
            continue
            
        if name in signal_cache:
            res = signal_cache[name].copy()
            res['reason'] = f"复用同名信号 ({name})"
            results[i] = res
            continue
            
        best_tp = None
        best_score = 0
        best_reason = ""
        
        for tp in tester_pins:
            if tp['id'] in used_tester_ids: continue
            
            score = get_semantic_score(name, tp['name'])
            if score > best_score:
                best_score = score
                best_tp = tp
                
        if best_tp and best_score > 40:
            res = {
                "match": True,
                "tester_id": best_tp['id'],
                "display_pin": best_tp['originalPin'],
                "display_conn": best_tp['tags'][0],
                "reason": "完全匹配" if best_score == 100 else "模糊语义匹配"
            }
            signal_cache[name] = res
            results[i] = res
            used_tester_ids.add(best_tp['id'])
        else:
            results[i] = {"match": False, "reason": "未匹配"}

    # Construct final dataframe
    df_output = df_bms.copy()
    df_output['[结果] 匹配状态'] = [r['reason'] if not r.get('match', False) else "已匹配" for r in results]
    df_output['[结果] EDAC连接器'] = [r.get('display_conn', '-') for r in results]
    df_output['[结果] EDAC脚位'] = [r.get('display_pin', '-') for r in results]
    df_output['[结果] 匹配逻辑'] = [r.get('reason', '-') for r in results]

    # Save with formatting
    output_path = bms_path.replace(".xlsx", "_匹配结果报告.xlsx")
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df_output.to_excel(writer, index=False, sheet_name='匹配结果')
        
        # Auto-adjust columns width
        worksheet = writer.sheets['匹配结果']
        for col in worksheet.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except: pass
            adjusted_width = (max_length + 2) * 1.2
            worksheet.column_dimensions[column].width = adjusted_width

    print(f"\n匹配完成！报告已导出至：\n{output_path}")

if __name__ == "__main__":
    main()
