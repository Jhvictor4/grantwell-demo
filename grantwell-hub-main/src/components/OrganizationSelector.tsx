import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building, Crown, Edit, Eye } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';

const roleIcons = {
  admin: Crown,
  editor: Edit,
  viewer: Eye
};

const roleColors = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  editor: 'bg-blue-100 text-blue-700 border-blue-200', 
  viewer: 'bg-gray-100 text-gray-700 border-gray-200'
};

export function OrganizationSelector() {
  const { organizations, currentOrganization, switchOrganization, loading } = useOrganization();

  if (loading) {
    return <div className="w-48 h-10 bg-gray-200 animate-pulse rounded" />;
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building className="h-4 w-4" />
        No organization
      </div>
    );
  }

  if (organizations.length === 1) {
    const org = organizations[0];
    const RoleIcon = roleIcons[org.role];
    
    return (
      <div className="flex items-center gap-2">
        <Building className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{org.organization.name}</span>
        <Badge className={`text-xs ${roleColors[org.role]}`}>
          <RoleIcon className="h-3 w-3 mr-1" />
          {org.role}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentOrganization?.organization.id || ''}
        onValueChange={switchOrganization}
      >
        <SelectTrigger className="w-64">
          <SelectValue>
            {currentOrganization && (
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentOrganization.organization.name}</span>
                <Badge className={`text-xs ${roleColors[currentOrganization.role]}`}>
                  {React.createElement(roleIcons[currentOrganization.role], { className: "h-3 w-3 mr-1" })}
                  {currentOrganization.role}
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {organizations.map((membership) => {
            const RoleIcon = roleIcons[membership.role];
            return (
              <SelectItem key={membership.organization.id} value={membership.organization.id}>
                <div className="flex items-center gap-2 w-full">
                  <span className="flex-1">{membership.organization.name}</span>
                  <Badge className={`text-xs ${roleColors[membership.role]}`}>
                    <RoleIcon className="h-3 w-3 mr-1" />
                    {membership.role}
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}