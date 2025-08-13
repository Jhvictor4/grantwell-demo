import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
}

interface TaskMultiAssignmentDropdownProps {
  taskId: string;
  assignedUserIds: string[];
  onAssignmentChange: (userIds: string[]) => void;
  className?: string;
}

export function TaskMultiAssignmentDropdown({ 
  taskId, 
  assignedUserIds, 
  onAssignmentChange, 
  className 
}: TaskMultiAssignmentDropdownProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name')
        .eq('approval_status', 'approved')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async (userId: string) => {
    if (assignedUserIds.includes(userId) || isUpdating) return;

    setIsUpdating(true);
    try {
      // Only insert to database if taskId exists (task is saved)
      if (taskId && taskId !== 'temp') {
        const { error } = await supabase
          .from('task_assignments')
          .insert({ task_id: taskId, user_id: userId, assigned_by: userId });

        if (error) throw error;
      }

      const newAssignedIds = [...assignedUserIds, userId];
      onAssignmentChange(newAssignedIds);

      toast({
        title: "Success",
        description: "User assigned to task",
      });
    } catch (error) {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: "Failed to assign user to task",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveAssignment = async (userId: string) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      // Only delete from database if taskId exists (task is saved)
      if (taskId && taskId !== 'temp') {
        const { error } = await supabase
          .from('task_assignments')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', userId);

        if (error) throw error;
      }

      const newAssignedIds = assignedUserIds.filter(id => id !== userId);
      onAssignmentChange(newAssignedIds);

      toast({
        title: "Success",
        description: "User removed from task",
      });
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from task",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const assignedUsers = profiles.filter(p => assignedUserIds.includes(p.id));
  const availableUsers = profiles.filter(p => !assignedUserIds.includes(p.id));

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading...</div>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Assigned Users */}
      {assignedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {assignedUsers.map((user) => (
            <Badge 
              key={user.id} 
              variant="secondary" 
              className="text-xs flex items-center gap-1"
            >
              {user.full_name ? user.full_name.split(' ')[0] : user.email.split('@')[0]}
              <button
                onClick={() => handleRemoveAssignment(user.id)}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add Assignment - only show if there are available users */}
      {availableUsers.length > 0 ? (
        <Select onValueChange={handleAddAssignment} disabled={isUpdating}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isUpdating ? "Updating..." : "Assign team member"}>
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span>{isUpdating ? "Updating..." : "Add assignee"}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="z-50">
            {availableUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <div>
                  <div className="font-medium">
                    {user.full_name || user.email}
                  </div>
                  {user.full_name && (
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  )}
                  {user.role && (
                    <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : assignedUsers.length > 0 ? (
        <div className="text-xs text-muted-foreground">All team members assigned</div>
      ) : null}
    </div>
  );
}