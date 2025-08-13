import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User, Users } from 'lucide-react';

interface AssignedUser {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
}

interface UserAssignmentDisplayProps {
  assignedUsers: AssignedUser[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
  showNames?: boolean;
}

export function UserAssignmentDisplay({ 
  assignedUsers, 
  maxDisplay = 3, 
  size = 'sm',
  showNames = false
}: UserAssignmentDisplayProps) {
  if (!assignedUsers || assignedUsers.length === 0) {
    return <span className="text-xs text-slate-500">No team</span>;
  }

  const displayUsers = assignedUsers.slice(0, maxDisplay);
  const remainingCount = assignedUsers.length - maxDisplay;

  const getInitials = (user: AssignedUser) => {
    if (user.full_name) {
      const names = user.full_name.trim().split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0].slice(0, 2).toUpperCase();
    }
    // Fallback to email-based initials
    const parts = user.email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base'
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {showNames ? (
          <div className="flex flex-wrap gap-1">
            {displayUsers.map((user) => (
              <Badge key={user.id} variant="secondary" className="text-xs">
                {user.full_name ? user.full_name.split(' ')[0] : user.email.split('@')[0]}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <Badge variant="outline" className="text-xs">
                +{remainingCount}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center -space-x-1">
            {displayUsers.map((user, index) => (
              <Tooltip key={user.id}>
                <TooltipTrigger>
                  <Avatar className={`${sizeClasses[size]} border-2 border-background`}>
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{user.full_name || user.email}</p>
                  {user.full_name && (
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  )}
                  {user.role && (
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
            {remainingCount > 0 && (
              <Tooltip>
                <TooltipTrigger>
                  <Avatar className={`${sizeClasses[size]} border-2 border-background bg-muted`}>
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      +{remainingCount}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>And {remainingCount} more...</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
        
        {assignedUsers.length > 1 && (
          <div className="flex items-center text-xs text-muted-foreground ml-1">
            <Users className="h-3 w-3" />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}