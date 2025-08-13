import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX } from 'lucide-react';
import { useSoundEffects } from '@/hooks/useSoundEffects';

const UserSoundSettings: React.FC = () => {
  const { settings, updateSoundSettings, sounds } = useSoundEffects();

  const handleToggle = async (enabled: boolean) => {
    await updateSoundSettings(enabled);
    
    // Play test sound if enabling
    if (enabled) {
      sounds.taskComplete();
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {settings.enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          Sound Effects
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="sound-effects" className="text-sm font-medium">
            Enable sound feedback
          </Label>
          <Switch
            id="sound-effects"
            checked={settings.enabled}
            onCheckedChange={handleToggle}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Hear subtle audio feedback when completing tasks, uploading files, and saving work.
        </p>
      </CardContent>
    </Card>
  );
};

export default UserSoundSettings;