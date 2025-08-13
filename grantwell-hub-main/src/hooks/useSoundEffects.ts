import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface SoundEffectsSettings {
  enabled: boolean;
  volume: number;
}

export const useSoundEffects = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SoundEffectsSettings>({
    enabled: true,
    volume: 0.3 // Subtle volume level
  });
  const [audioCache, setAudioCache] = useState<Map<string, HTMLAudioElement>>(new Map());

  // Load user sound preferences
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('sound_effects_enabled')
          .eq('id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading sound settings:', error);
          return;
        }

        if (data) {
          setSettings(prev => ({ ...prev, enabled: data.sound_effects_enabled }));
        } else {
          // Create default settings for new user
          await supabase
            .from('user_settings')
            .insert({ id: user.id, sound_effects_enabled: true });
        }
      } catch (error) {
        console.error('Error loading sound settings:', error);
      }
    };

    loadUserSettings();
  }, [user?.id]);

  // Preload audio files
  useEffect(() => {
    const sounds = [
      'task-complete.mp3',
      'file-upload.mp3', 
      'save-action.mp3'
    ];

    const newCache = new Map();
    sounds.forEach(sound => {
      const audio = new Audio(`/sounds/${sound}`);
      audio.volume = settings.volume;
      audio.preload = 'auto';
      newCache.set(sound, audio);
    });

    setAudioCache(newCache);

    return () => {
      // Cleanup audio objects
      newCache.forEach(audio => {
        audio.src = '';
        audio.load();
      });
    };
  }, [settings.volume]);

  const playSound = useCallback(async (soundName: string) => {
    // Check for reduced motion preference (affects audio too)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if (!settings.enabled) return;

    const audio = audioCache.get(soundName);
    if (!audio) return;

    try {
      audio.currentTime = 0; // Reset to beginning
      await audio.play();
    } catch (error) {
      // Ignore autoplay policy errors
      console.debug('Audio play prevented:', error);
    }
  }, [settings.enabled, audioCache]);

  const updateSoundSettings = useCallback(async (enabled: boolean) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ 
          id: user.id, 
          sound_effects_enabled: enabled,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, enabled }));
    } catch (error) {
      console.error('Error updating sound settings:', error);
    }
  }, [user?.id]);

  const sounds = {
    taskComplete: () => playSound('task-complete.mp3'),
    fileUpload: () => playSound('file-upload.mp3'),
    saveAction: () => playSound('save-action.mp3')
  };

  return {
    settings,
    updateSoundSettings,
    sounds
  };
};