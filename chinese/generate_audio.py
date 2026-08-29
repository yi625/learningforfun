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

print(f"Generating high quality Mandarin AI audio for {len(unique_hanzi)} words...")

def get_audio_filename(text):
    h = hashlib.md5(text.encode('utf-8')).hexdigest()[:12]
    return f"{h}.mp3"

audio_manifest = {}
sem = asyncio.Semaphore(6)

async def generate_one(idx, word):
    fname = get_audio_filename(word)
    fpath = os.path.join(AUDIO_DIR, fname)
    rel_path = f"audio/{fname}"
    audio_manifest[word] = rel_path
    
    if os.path.exists(fpath) and os.path.getsize(fpath) > 500:
        return
    
    async with sem:
        for attempt in range(3):
            try:
                # Use Warm, Clear Child Teacher Neural Voice (zh-CN-XiaoxiaoNeural)
                communicate = edge_tts.Communicate(word, 'zh-CN-XiaoxiaoNeural', rate="+0%", pitch="+0Hz")
                await communicate.save(fpath)
                print(f"[{idx+1}/{len(unique_hanzi)}] Saved: {word} -> {rel_path}")
                return
            except Exception as e:
                print(f"Retry {word} due to: {e}")
                await asyncio.sleep(0.5)

async def main():
    tasks = [generate_one(i, word) for i, word in enumerate(unique_hanzi)]
    await asyncio.gather(*tasks)
    
    manifest_js_path = os.path.join(os.path.dirname(__file__), 'audio_manifest.js')
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write(f"const AUDIO_MANIFEST = {json.dumps(audio_manifest, ensure_ascii=False, indent=2)};\n")
    print(f"All {len(unique_hanzi)} audio clips generated successfully! Manifest saved.")

asyncio.run(main())
