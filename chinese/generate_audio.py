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

# Family Tree & Relative Explanations (Pure, ultra-smooth, sweet child-teacher Mandarin voice)
EXTRA_PHRASES_ZH = {
    "yeye_desc": "爷爷，爸爸的爸爸。",
    "nainai_desc": "奶奶，爸爸的妈妈。",
    "waigong_desc": "外公，也可以叫公公，妈妈的爸爸。",
    "waipo_desc": "外婆，也可以叫婆婆，妈妈的妈妈。",
    "dabo_desc": "大伯，爸爸的哥哥。",
    "bomu_desc": "伯母，大伯的妻子。",
    "baba_desc": "爸爸，我的父亲。",
    "shushu_desc": "叔叔，爸爸的弟弟。",
    "shenshen_desc": "婶婶，叔叔的妻子。",
    "gugu_desc": "姑姑，爸爸的姐妹。",
    "guzhang_desc": "姑丈，姑姑的丈夫。",
    "jiujiu_desc": "舅舅，妈妈的兄弟。",
    "jiuma_desc": "舅妈，舅舅的妻子。",
    "mama_desc": "妈妈，我的母亲。",
    "ayi_desc": "阿姨，妈妈的姐妹。",
    "yizhang_desc": "姨丈，阿姨的丈夫。",
    "tangge_desc": "堂哥，大伯或叔叔的儿子，比我大。",
    "tangjie_desc": "堂姐，大伯或叔叔的女儿，比我大。",
    "tangdi_desc": "堂弟，大伯或叔叔的儿子，比我小。",
    "堂弟_desc": "堂弟，大伯或叔叔的儿子，比我小。",
    "tangmei_desc": "堂妹，大伯或叔叔的女儿，比我小。",
    "biaoge_p_desc": "表哥，姑姑的儿子，比我大。",
    "biaomei_p_desc": "表妹，姑姑的女儿，比我小。",
    "biaoge_m_desc": "表哥，舅舅或阿姨的儿子，比我大。",
    "biaojie_m_desc": "表姐，舅舅或阿姨的女儿，比我大。",
    "biaodi_m_desc": "表弟，舅舅或阿姨的儿子，比我小。",
    "biaomei_m_desc": "表妹，舅舅或阿姨的女儿，比我小。",
    "me_p_desc": "这是我，华语小天才！",
    "me_m_desc": "这是我，华语小天才！",
    "tab_paternal": "爸爸这一边：认识爷爷、奶奶、大伯、叔叔、姑姑与堂兄弟姐妹！",
    "tab_maternal": "妈妈这一边：认识外公、外婆、舅舅、阿姨与表兄弟姐妹！",
    "tab_guide": "亲戚称谓秘籍：认识大伯、叔叔、舅舅与堂表亲戚！",
    "guide_dabo_zh": "大伯，爸爸的哥哥，英语叫 Uncle。",
    "guide_shushu_zh": "叔叔，爸爸的弟弟，英语叫 Uncle。",
    "guide_jiujiu_zh": "舅舅，妈妈的兄弟，英语叫 Uncle。",
    "guide_guzhang_zh": "姑丈，姑姑的丈夫，英语叫 Uncle。",
    "guide_yizhang_zh": "姨丈，阿姨的丈夫，英语叫 Uncle。",
    "guide_tang_zh": "堂亲，同姓氏！爸爸兄弟的孩子，叫堂哥、堂姐、堂弟、堂妹。",
    "guide_biao_zh": "表亲，不同姓氏！姑姑、舅舅和阿姨的孩子，叫表哥、表姐、表弟、表妹。"
}

# English Explanations (Natural, warm, cheerful JennyNeural teacher voice)
EXTRA_PHRASES_EN = {
    "yeye_en": "Grandfather, Dad's Father!",
    "nainai_en": "Grandmother, Dad's Mother!",
    "waigong_en": "Grandfather, Mom's Father!",
    "waipo_en": "Grandmother, Mom's Mother!",
    "dabo_en": "Uncle, Dad's elder brother!",
    "bomu_en": "Aunt, elder uncle's wife!",
    "baba_en": "Father, Dad!",
    "shushu_en": "Uncle, Dad's younger brother!",
    "shenshen_en": "Aunt, younger uncle's wife!",
    "gugu_en": "Aunt, Dad's sister!",
    "guzhang_en": "Uncle, Aunt's husband!",
    "jiujiu_en": "Uncle, Mom's brother!",
    "jiuma_en": "Aunt, Mom's brother's wife!",
    "mama_en": "Mother, Mom!",
    "ayi_en": "Aunt, Mom's sister!",
    "yizhang_en": "Uncle, Mom's sister's husband!",
    "tangge_en": "Cousin, Dad's brother's elder son!",
    "tangjie_en": "Cousin, Dad's brother's elder daughter!",
    "tangdi_en": "Cousin, Dad's brother's younger son!",
    "tangmei_en": "Cousin, Dad's brother's younger daughter!",
    "biaoge_p_en": "Cousin, Dad's sister's elder son!",
    "biaomei_p_en": "Cousin, Dad's sister's younger daughter!",
    "biaoge_m_en": "Cousin, Mom's sibling's elder son!",
    "biaojie_m_en": "Cousin, Mom's sibling's elder daughter!",
    "biaodi_m_en": "Cousin, Mom's sibling's younger son!",
    "biaomei_m_en": "Cousin, Mom's sibling's younger daughter!",
    "me_p_en": "This is me, Chinese superstar!",
    "me_m_en": "This is me, Chinese superstar!",
    "tab_paternal_en": "Father's side: grandparents, uncles, aunts and paternal cousins!",
    "tab_maternal_en": "Mother's side: grandparents, uncles, aunts and maternal cousins!",
    "tab_guide_en": "Chinese relatives guide: why Chinese distinguishes different uncles and cousins!",
    "guide_dabo_en": "Dà bó: Uncle, your father's elder brother.",
    "guide_shushu_en": "Shū shu: Uncle, your father's younger brother.",
    "guide_jiujiu_en": "Jiù jiu: Uncle, your mother's brother.",
    "guide_guzhang_en": "Gū zhàng: Uncle, your father's sister's husband.",
    "guide_yizhang_en": "Yí zhàng: Uncle, your mother's sister's husband.",
    "guide_tang_en": "Táng cousins: Paternal cousins who share your family surname! The children of your father's brothers are called Táng Gē, Táng Jiě, Táng Dì, and Táng Mèi.",
    "guide_biao_en": "Biǎo cousins: Cousins with different family surnames! The children of your aunts and maternal uncles are called Biǎo Gē, Biǎo Jiě, Biǎo Dì, and Biǎo Mèi."
}

all_items = (
    [(w, w, 'zh-CN-XiaoxiaoNeural') for w in unique_hanzi] +
    [(k, v, 'zh-CN-XiaoxiaoNeural') for k, v in EXTRA_PHRASES_ZH.items()] +
    [(k, v, 'en-US-JennyNeural') for k, v in EXTRA_PHRASES_EN.items()]
)

print(f"Generating high quality AI audio for {len(all_items)} clips...")

def get_audio_filename(text):
    h = hashlib.md5(text.encode('utf-8')).hexdigest()[:12]
    return f"{h}.mp3"

audio_manifest = {}
sem = asyncio.Semaphore(6)

async def generate_one(idx, key, text_to_speak, voice_model):
    fname = get_audio_filename(key)
    fpath = os.path.join(AUDIO_DIR, fname)
    rel_path = f"audio/{fname}"
    audio_manifest[key] = rel_path
    
    if os.path.exists(fpath) and os.path.getsize(fpath) > 500:
        return
    
    async with sem:
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(text_to_speak, voice_model, rate="+0%", pitch="+0Hz")
                await communicate.save(fpath)
                print(f"[{idx+1}/{len(all_items)}] Saved: {key} -> {rel_path} ({voice_model})")
                return
            except Exception as e:
                print(f"Retry {key} due to: {e}")
                await asyncio.sleep(0.5)

async def main():
    tasks = [generate_one(i, item[0], item[1], item[2]) for i, item in enumerate(all_items)]
    await asyncio.gather(*tasks)
    
    manifest_js_path = os.path.join(os.path.dirname(__file__), 'audio_manifest.js')
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write(f"const AUDIO_MANIFEST = {json.dumps(audio_manifest, ensure_ascii=False, indent=2)};\n")
    print(f"All {len(all_items)} audio clips generated successfully! Manifest saved.")

asyncio.run(main())
