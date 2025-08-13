import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, X } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  role: string;
  full_name?: string;
}

interface TaskAssignmentDropdownProps {
  assignedUserId?: string;
  onAssignmentChange: (userId: string | null) => void;
  className?: string;
}

export function TaskAssignmentDropdown({
  assignedUserId,
  onAssignmentChange,
  className = ''
}: TaskAssignmentDropdownProps) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(assignedUserId);

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    setSelectedUserId(assignedUserId);
  }, [assignedUserId]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name')
        .eq('approval_status', 'approved')
        .order('full_name, email');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load user profiles.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = (value: string) => {
    if (value === 'unassigned') {
      setSelectedUserId(undefined);
      onAssignmentChange(null);
    } else {
      setSelectedUserId(value);
      onAssignmentChange(value);
    }
  };

  const selectedUser = profiles.find(p => p.id === selectedUserId);

  return (
    <div className={className}>
      <Select value={selectedUserId || 'unassigned'} onValueChange={handleAssignmentChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select assignee">
            {selectedUser ? (selectedUser.full_name || selectedUser.email) : 'Unassigned'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {profiles.map(profile => (
            <SelectItem key={profile.id} value={profile.id}>
              <div>
                <div className="font-medium">{profile.full_name || profile.email}</div>
                {profile.full_name && (
                  <div className="text-xs text-slate-500">{profile.email}</div>
                )}
                <div className="text-xs text-slate-500 capitalize">{profile.role}</div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}