import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  Calendar, 
  FileText, 
  BarChart3, 
  LogOut, 
  User, 
  Search, 
  Settings, 
  CheckSquare, 
  ChevronDown,
  Target,
  PieChart,
  Compass,
  PenTool,
  Monitor
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mainNavItems } from '@/config/nav';

const Navbar = () => {
  const { user, signOut, userRole } = useAuth();
  const location = useLocation();
  const [profileName, setProfileName] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchProfileName();
    }
  }, [user]);

  const fetchProfileName = async () => {
    if (!user) return;
    
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      if (profileData?.full_name) {
        // Extract first name from full name
        const firstName = profileData.full_name.split(' ')[0];
        setProfileName(firstName);
      }
    } catch (error) {
      console.error('Error fetching profile name:', error);
    }
  };

  if (!user) return null;

  // Extract user's display name with fallback logic
  const getDisplayName = () => {
    if (profileName) return profileName;
    
    const userMetadata = user.user_metadata || {};
    const firstName = userMetadata.first_name || userMetadata.firstName;
    const fullName = userMetadata.full_name || userMetadata.name;
    
    if (firstName) return firstName;
    if (fullName) return fullName.split(' ')[0]; // Get first name from full name
    return 'User';
  };

  const displayName = getDisplayName();

  const isActive = (path: string) => location.pathname === path;
  const isPathActive = (paths: string[]) =>
    paths.some((path) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)));

  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link to="/" className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Grantwell</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-2">
            {mainNavItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                aria-current={isPathActive(item.matchPaths || [item.url]) ? 'page' : undefined}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap ${
                  isPathActive(item.matchPaths || [item.url])
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline text-sm min-w-0 max-w-[120px] truncate">{displayName}</span>
                {userRole && (
                  <Badge 
                    variant={userRole === 'admin' ? 'default' : 'secondary'}
                    className={`${userRole === 'admin' ? 'bg-blue-600' : 'bg-slate-600'} hidden sm:inline-flex text-xs whitespace-nowrap`}
                  >
                    {userRole}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2 text-sm text-slate-600">
                <div className="font-medium truncate">{user.email}</div>
                {userRole && (
                  <div className="text-xs text-slate-500 capitalize">{userRole} Access</div>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center space-x-3 p-3">
                  <Settings className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Settings</div>
                    <div className="text-xs text-slate-500">Profile & preferences</div>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/integrations" className="flex items-center space-x-3 p-3">
                  <Settings className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Integrations</div>
                    <div className="text-xs text-slate-500">Connect external tools</div>
                  </div>
                </Link>
              </DropdownMenuItem>
              {(userRole === 'admin' || userRole === 'manager') && (
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center space-x-3 p-3">
                    <Settings className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Admin Dashboard</div>
                      <div className="text-xs text-slate-500">System management</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600 p-3">
                <LogOut className="h-4 w-4 mr-3" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;