import speech_recognition as sr
print('Init recognizer...')
r = sr.Recognizer()
r.dynamic_energy_threshold = False
r.energy_threshold = 400

print('Init mic...')
m = sr.Microphone()

print('Entering with block...')
with m as s:
    print('Listening for 5 seconds...')
    try:
        audio = r.listen(s, timeout=5, phrase_time_limit=4)
        print('Got audio!', len(audio.get_raw_data()))
    except sr.WaitTimeoutError:
        print('Timeout')
    except Exception as e:
        print('Error:', e)
print('Done!')
