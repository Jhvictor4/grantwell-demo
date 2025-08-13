import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth';
import { 
  Shield, 
  Menu, 
  Calendar, 
  FileText, 
  BarChart3, 
  LogOut, 
  User, 
  Search, 
  Settings, 
  CheckSquare,
  Target,
  PieChart,
  Compass,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { mainNavItems } from '@/config/nav';

export function MobileNavbar() {
  const { user, signOut, userRole } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;
  const isPathActive = (paths: string[]) =>
    paths.some((path) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)));

  const closeSheet = () => setIsOpen(false);

  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-4 py-3 md:hidden">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Grantwell</span>
        </Link>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-slate-900 border-slate-700">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-700">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-white">Grantwell</span>
                </div>
                <Button variant="ghost" size="sm" onClick={closeSheet} className="text-slate-400">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* User Info */}
              <div className="py-4 border-b border-slate-700">
                <div className="text-sm text-slate-300">
                  <div className="font-medium truncate">{user.email}</div>
                  {userRole && (
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge 
                        variant={userRole === 'admin' ? 'default' : 'secondary'}
                        className={`${userRole === 'admin' ? 'bg-blue-600' : 'bg-slate-600'} text-xs`}
                      >
                        {userRole}
                      </Badge>
                      <span className="text-xs text-slate-500">Access Level</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 py-6 space-y-2">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={closeSheet}
                    aria-current={isPathActive(item.matchPaths || [item.url]) ? 'page' : undefined}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isPathActive(item.matchPaths || [item.url])
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <div>
                      <div className="font-medium">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-xs text-slate-400">{item.subtitle}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <Button
                  onClick={() => {
                    closeSheet();
                    signOut();
                  }}
                  variant="ghost"
                  className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}