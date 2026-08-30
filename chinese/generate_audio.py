import asyncio
import edge_tts
import json
import os
import hashlib
import re
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

AUDIO_DIR = os.path.join(os.path.dirname(__file__), 'audio')
os.makedirs(AUDIO_DIR, exist_ok=True)

# Parse data.js to extract all Hanzi words
data_path = os.path.join(os.path.dirname(__file__), 'data.js')
with open(data_path, 'r', encoding='utf-8') as f:
    content = f.read()

matches = re.findall(r'hanzi:\s*"([^"]+)"', content)
unique_hanzi = list(dict.fromkeys(matches))

# Family Tree & Relative Explanations
EXTRA_PHRASES = {
    "yeye_desc": "爷爷，爸爸的爸爸！Grandfather, Dad's Father!",
    "nainai_desc": "奶奶，爸爸的妈妈！Grandmother, Dad's Mother!",
    "waigong_desc": "外公，也可以叫公公或姥爷，妈妈的爸爸！Grandfather, Mom's Father!",
    "waipo_desc": "外婆，也可以叫婆婆或姥姥，妈妈的妈妈！Grandmother, Mom's Mother!",
    "dabo_desc": "大伯，爸爸的哥哥，英语叫 Uncle！Uncle, Dad's elder brother!",
    "bomu_desc": "伯母，大伯的妻子，英语叫 Aunt！Aunt, elder uncle's wife!",
    "baba_desc": "爸爸，我的父亲！Father, Dad!",
    "shushu_desc": "叔叔，爸爸的弟弟，英语叫 Uncle！Uncle, Dad's younger brother!",
    "shenshen_desc": "婶婶，叔叔的妻子，英语叫 Aunt！Aunt, younger uncle's wife!",
    "gugu_desc": "姑姑，爸爸的姐妹，英语叫 Aunt！Aunt, Dad's sister!",
    "guzhang_desc": "姑丈，姑姑的丈夫，英语叫 Uncle！Uncle, Aunt's husband!",
    "jiujiu_desc": "舅舅，妈妈的兄弟，英语叫 Uncle！Uncle, Mom's brother!",
    "jiuma_desc": "舅妈，舅舅的妻子，英语叫 Aunt！Aunt, Mom's brother's wife!",
    "mama_desc": "妈妈，我的母亲！Mother, Mom!",
    "ayi_desc": "阿姨，也可以叫姨妈，妈妈的姐妹，英语叫 Aunt！Aunt, Mom's sister!",
    "yizhang_desc": "姨丈，阿姨的丈夫，英语叫 Uncle！Uncle, Mom's sister's husband!",
    "tangge_desc": "堂哥，大伯或叔叔的儿子，比我大，同姓氏！Cousin, Dad's brother's elder son!",
    "tangjie_desc": "堂姐，大伯或叔叔的女儿，比我大，同姓氏！Cousin, Dad's brother's elder daughter!",
    "tangdi_desc": "堂弟，大伯或叔叔的儿子，比我小，同姓氏！Cousin, Dad's brother's younger son!",
    "堂弟_desc": "堂弟，大伯或叔叔的儿子，比我小，同姓氏！Cousin, Dad's brother's younger son!",
    "tangmei_desc": "堂妹，大伯或叔叔的女儿，比我小，同姓氏！Cousin, Dad's brother's younger daughter!",
    "biaoge_p_desc": "表哥，姑姑的儿子，比我大！Cousin, Dad's sister's elder son!",
    "biaomei_p_desc": "表妹，姑姑的女儿，比我小！Cousin, Dad's sister's younger daughter!",
    "biaoge_m_desc": "表哥，舅舅或阿姨的儿子，比我大！Cousin, Mom's sibling's elder son!",
    "biaojie_m_desc": "表姐，舅舅或阿姨的女儿，比我大！Cousin, Mom's sibling's elder daughter!",
    "biaodi_m_desc": "表弟，舅舅或阿姨的儿子，比我小！Cousin, Mom's sibling's younger son!",
    "biaomei_m_desc": "表妹，舅舅或阿姨的女儿，比我小！Cousin, Mom's sibling's younger daughter!",
    "me_p_desc": "这是我，华语小天才！This is me, Chinese superstar!",
    "me_m_desc": "这是我，华语小天才！This is me, Chinese superstar!",
    "tab_paternal": "爸爸这一边：认识爷爷、奶奶、大伯、叔叔、姑姑与堂兄弟姐妹！",
    "tab_maternal": "妈妈这一边：认识外公、外婆、舅舅、阿姨与表兄弟姐妹！",
    "tab_guide": "亲戚称谓秘籍：为什么英文叫 Uncle，华语分大伯、叔叔、舅舅、姑丈与姨丈！"
}

all_items = [(w, w) for w in unique_hanzi] + [(k, v) for k, v in EXTRA_PHRASES.items()]

print(f"Generating high quality Mandarin AI audio for {len(all_items)} clips...")

def get_audio_filename(text):
    h = hashlib.md5(text.encode('utf-8')).hexdigest()[:12]
    return f"{h}.mp3"

audio_manifest = {}
sem = asyncio.Semaphore(6)

async def generate_one(idx, key, text_to_speak):
    fname = get_audio_filename(key)
    fpath = os.path.join(AUDIO_DIR, fname)
    rel_path = f"audio/{fname}"
    audio_manifest[key] = rel_path
    
    if os.path.exists(fpath) and os.path.getsize(fpath) > 500:
        return
    
    async with sem:
        for attempt in range(3):
            try:
                # Use Warm, Clear Child Teacher Neural Voice (zh-CN-XiaoxiaoNeural)
                communicate = edge_tts.Communicate(text_to_speak, 'zh-CN-XiaoxiaoNeural', rate="+0%", pitch="+0Hz")
                await communicate.save(fpath)
                print(f"[{idx+1}/{len(all_items)}] Saved: {key} -> {rel_path}")
                return
            except Exception as e:
                print(f"Retry {key} due to: {e}")
                await asyncio.sleep(0.5)

async def main():
    tasks = [generate_one(i, item[0], item[1]) for i, item in enumerate(all_items)]
    await asyncio.gather(*tasks)
    
    manifest_js_path = os.path.join(os.path.dirname(__file__), 'audio_manifest.js')
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write(f"const AUDIO_MANIFEST = {json.dumps(audio_manifest, ensure_ascii=False, indent=2)};\n")
    print(f"All {len(all_items)} audio clips generated successfully! Manifest saved.")

asyncio.run(main())
