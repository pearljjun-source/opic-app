import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TTS_DEFAULTS,
  TTS_VOICES,
  TTS_SPEEDS,
  type TtsVoiceKey,
  type TtsSpeedKey,
} from '@/lib/constants';

const TTS_VOICE_KEY = '@opic_app_tts_voice';
const TTS_SPEED_KEY = '@opic_app_tts_speed';

export function useTtsPreferences() {
  const [voice, setVoiceState] = useState<TtsVoiceKey>(TTS_DEFAULTS.VOICE);
  const [speed, setSpeedState] = useState<TtsSpeedKey>(TTS_DEFAULTS.SPEED);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedVoice, storedSpeed] = await Promise.all([
          AsyncStorage.getItem(TTS_VOICE_KEY),
          AsyncStorage.getItem(TTS_SPEED_KEY),
        ]);
        if (storedVoice && TTS_VOICES.some((v) => v.key === storedVoice)) {
          setVoiceState(storedVoice as TtsVoiceKey);
        }
        if (storedSpeed) {
          const parsed = parseFloat(storedSpeed);
          if (TTS_SPEEDS.some((s) => s.key === parsed)) {
            setSpeedState(parsed as TtsSpeedKey);
          }
        }
      } catch {
        // AsyncStorage 실패 시 기본값 유지
      }
      setLoaded(true);
    })();
  }, []);

  const setVoice = useCallback(async (v: TtsVoiceKey) => {
    setVoiceState(v);
    await AsyncStorage.setItem(TTS_VOICE_KEY, v).catch(() => {});
  }, []);

  const setSpeed = useCallback(async (s: TtsSpeedKey) => {
    setSpeedState(s);
    await AsyncStorage.setItem(TTS_SPEED_KEY, String(s)).catch(() => {});
  }, []);

  return { voice, speed, setVoice, setSpeed, loaded };
}
