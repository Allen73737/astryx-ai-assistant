import re
import os

files_to_update = [
    'c:/My_Project/Jarvis/src/renderer/src/components/panels/LeftPanel.tsx',
    'c:/My_Project/Jarvis/src/renderer/src/components/panels/BottomBar.tsx',
    'c:/My_Project/Jarvis/src/renderer/src/components/core/HUDOverlay.tsx'
]

replacements = {
    'astryx-gold': 'white',
    'astryx-cyan': 'white',
    'astryx-surface-light': 'white',
    'bg-astryx-surface': 'bg-transparent',
    'text-astryx-text-secondary': 'text-white/60',
    'text-astryx-text': 'text-white/90',
    'astryx-border': 'white/20',
    '#cfa144': 'rgba(255,255,255,0.8)',
    '#00d4ff': 'rgba(255,255,255,0.8)',
    'shadow-[0_0_20px_rgba(207,161,68,0.05)]': 'shadow-[0_20px_40px_rgba(0,0,0,0.4)]',
    'border-astryx-error': 'border-red-400',
    'text-astryx-error': 'text-red-400'
}

for file_path in files_to_update:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("HUD elements polished successfully.")
