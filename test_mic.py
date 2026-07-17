import speech_recognition as sr
r = sr.Recognizer()
m = sr.Microphone()
r.dynamic_energy_threshold = False
r.energy_threshold = 400
with m as s:
    print('Listening...')
    try:
        audio = r.listen(s, timeout=5, phrase_time_limit=4)
        print('Got audio!', len(audio.get_raw_data()))
        text = r.recognize_google(audio)
        print('Heard:', text)
    except sr.WaitTimeoutError:
        print('Timeout')
    except Exception as e:
        print('Error:', e)
