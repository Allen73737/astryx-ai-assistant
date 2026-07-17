import sys
import pygame
import time

try:
    with open("C:/My_Project/Jarvis/backend/play_mp3.log", "a") as f:
        f.write("Starting playback...\n")
    file_path = sys.argv[1]
    pygame.mixer.init(frequency=24000)
    pygame.mixer.music.load(file_path)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        time.sleep(0.05)
    pygame.mixer.quit()
    with open("C:/My_Project/Jarvis/backend/play_mp3.log", "a") as f:
        f.write("Playback finished successfully.\n")
except Exception as e:
    with open("C:/My_Project/Jarvis/backend/play_mp3.log", "a") as f:
        f.write(f"Error: {e}\n")
