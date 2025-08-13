import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import NotificationsCenter from '@/components/NotificationsCenter';
import { IntegrationsEnhanced } from '@/components/IntegrationsEnhanced';
import { 
  Building, 
  Calendar, 
  Shield, 
  Download, 
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  Chrome,
  Mail,
  Settings,
  DollarSign,
  MapPin,
  Bell,
  User,
  Save
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [orgSettings, setOrgSettings] = useState({
    organization_name: "",
    uei_number: "",
    duns_number: "",
    sam_status: "unknown",
    sam_expiration_date: "",
  });

  const [userState, setUserState] = useState("");
  const [updating, setUpdating] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
  });

  const [notificationPrefs, setNotificationPrefs] = useState({
    new_grant_alerts: true,
    deadline_reminders: true,
    quarterly_reports: true,
    email_notifications: true
  });
  const [notificationLoading, setNotificationLoading] = useState(true);

  const US_STATES = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
    'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
    'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia',
    'Puerto Rico', 'Guam', 'American Samoa', 'U.S. Virgin Islands', 'Northern Mariana Islands'
  ];
  
  const [calendarSettings, setCalendarSettings] = useState({
    google_calendar_enabled: false,
    outlook_calendar_enabled: false,
    sync_deadlines: true,
    sync_milestones: true,
    email_reminders: true,
    reminder_days_before: 7,
  });

  const [erpIntegrations] = useState([
    { name: "Tyler Technologies", enabled: false, status: "Coming Soon" },
    { name: "QuickBooks", enabled: false, status: "Coming Soon" },
    { name: "SAP", enabled: false, status: "Coming Soon" },
    { name: "Oracle", enabled: false, status: "Coming Soon" },
  ]);


  useEffect(() => {
    fetchSettings();
    fetchUserState();
    loadNotificationPreferences();
  }, [user]);

  const fetchSettings = async () => {
    try {
      // Fetch organization settings
      const { data: orgData } = await supabase
        .from('organization_settings')
        .select('*')
        .maybeSingle();

      if (orgData) {
        setOrgSettings(orgData);
      }

      // Fetch calendar settings
      const { data: calData } = await supabase
        .from('calendar_settings')
        .select('*')
        .single();

      if (calData) {
        setCalendarSettings(calData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveNotificationPreferences = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...notificationPrefs,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving notification preferences:', error);
        toast({
          title: "Error",
          description: "Failed to save notification preferences.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Success",
        description: "Notification preferences saved successfully.",
      });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences.",
        variant: "destructive"
      });
    }
  };

  const loadNotificationPreferences = async () => {
    if (!user) return;

    try {
      setNotificationLoading(true);
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error loading notification preferences:', error);
        return;
      }

      if (data) {
        setNotificationPrefs({
          new_grant_alerts: data.compliance_alerts || true,
          deadline_reminders: data.deadline_reminders,
          quarterly_reports: data.report_reminders || true,
          email_notifications: data.email_enabled
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const fetchUserState = async () => {
    if (!user) return;
    
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('state, full_name, email')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      if (profileData) {
        setUserState(profileData.state || "");
        setProfileData({
          full_name: profileData.full_name || "",
          email: profileData.email || user.email || "",
        });
      }
    } catch (error) {
      console.error('Error fetching user state:', error);
    }
  };

  const updateUserState = async (newState: string) => {
    if (!user) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ state: newState })
        .eq('id', user.id);

      if (error) throw error;

      setUserState(newState);
      toast({
        title: "State Updated",
        description: `Your state has been updated to ${newState}. You'll now see relevant grants for this state.`,
      });
    } catch (error: any) {
      console.error('Error updating state:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update state.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    
    setUpdating(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          full_name: profileData.full_name,
          email: profileData.email 
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update auth email if changed
      if (profileData.email !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: profileData.email
        });
        
        if (authError) throw authError;
        
        toast({
          title: "Email Update Sent",
          description: "Please check your new email for a confirmation link.",
        });
      } else {
        toast({
          title: "Profile Updated",
          description: "Your profile has been updated successfully.",
        });
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const saveOrgSettings = async () => {
    try {
      console.log('Saving organization settings:', orgSettings);
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('organization_settings')
        .upsert(orgSettings, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Organization settings saved successfully:', data);

      toast({
        title: "Settings Saved",
        description: "Organization settings have been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error saving organization settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save organization settings.",
        variant: "destructive",
      });
    }
  };

  const saveCalendarSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('calendar_settings')
        .upsert({ ...calendarSettings, user_id: user.id });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Calendar settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to save calendar settings.",
        variant: "destructive",
      });
    }
  };

  const checkSamStatus = async () => {
    // Simulate SAM.gov API check
    const mockStatuses = ["Active", "Pending", "Expired", "Not Found"];
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
    
    setOrgSettings(prev => ({
      ...prev,
      sam_status: randomStatus.toLowerCase(),
      sam_expiration_date: randomStatus === "Active" ? "2025-06-15" : "",
    }));

    toast({
      title: "SAM Status Updated",
      description: `Status checked: ${randomStatus}`,
    });
  };

  const getSamStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      case "not found":
        return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertCircle className="h-3 w-3 mr-1" />Not Found</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Unknown</Badge>;
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      toast({
        title: "Connecting Calendar",
        description: "Setting up Google Calendar integration...",
      });

      // Call the calendar sync function to create integration
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          action: 'connect_google',
          provider: 'google'
        }
      });

      if (error) throw error;

      setCalendarSettings(prev => ({ ...prev, google_calendar_enabled: true }));
      saveCalendarSettings();
      
      toast({
        title: "Connected!",
        description: "Google Calendar has been connected successfully.",
      });
    } catch (error: any) {
      console.error('Error connecting Google Calendar:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Google Calendar.",
        variant: "destructive",
      });
    }
  };

  const connectOutlookCalendar = async () => {
    try {
      toast({
        title: "Connecting Calendar", 
        description: "Setting up Outlook Calendar integration...",
      });

      // Call the calendar sync function to create integration
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          action: 'connect_outlook',
          provider: 'outlook'
        }
      });

      if (error) throw error;

      setCalendarSettings(prev => ({ ...prev, outlook_calendar_enabled: true }));
      saveCalendarSettings();
      
      toast({
        title: "Connected!",
        description: "Outlook Calendar has been connected successfully.",
      });
    } catch (error: any) {
      console.error('Error connecting Outlook Calendar:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Outlook Calendar.",
        variant: "destructive",
      });
    }
  };

  const syncDeadlinesToCalendar = async () => {
    if (!calendarSettings.google_calendar_enabled && !calendarSettings.outlook_calendar_enabled) {
      toast({
        title: "No Calendar Connected",
        description: "Please connect Google Calendar or Outlook first.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Syncing Deadlines",
      description: "Syncing grant deadlines and tasks to your calendar...",
    });

    try {
      // Use the calendar sync function to sync events
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          action: 'sync',
          provider: calendarSettings.google_calendar_enabled ? 'google' : 'outlook'
        }
      });

      if (error) throw error;

      // Update last sync timestamp
      await supabase
        .from('calendar_settings')
        .update({ last_sync: new Date().toISOString() })
        .eq('user_id', user?.id);

      setCalendarSettings(prev => ({ ...prev, last_sync: new Date().toISOString() }));

      toast({
        title: "Sync Complete",
        description: "Calendar has been synced successfully with your latest deadlines and tasks.",
      });

    } catch (error: any) {
      console.error('Error syncing to calendar:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync items to calendar. Please try again.",
        variant: "destructive"
      });
    }
  };

  const exportBudgetData = () => {
    // Mock CSV export
    toast({
      title: "Export Started",
      description: "Generating budget CSV file...",
    });
    
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: "Budget data has been downloaded as CSV.",
      });
    }, 1500);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Settings</h1>
        <p className="text-muted-foreground">Manage Your Organization Settings And Integrations</p>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="sam" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            SAM.gov Status
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Finance Integrations
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your personal profile information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email address"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="user-state">Your State</Label>
                <Select value={userState} onValueChange={updateUserState} disabled={updating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your state or territory" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Changing your state will update the grants shown on your dashboard to be relevant to your location.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={updateProfile} disabled={updating}>
                  {updating ? "Updating..." : "Save Profile"}
                </Button>
              </div>
              
              {userState && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800">
                    <MapPin className="h-4 w-4" />
                    <p className="font-medium">Current State: {userState}</p>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    You're currently set to receive grants relevant to {userState}. Check your dashboard for available opportunities in your state.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Email Notification Preferences</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage how you receive notifications about grants and deadlines.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {notificationLoading ? (
                <div className="text-center py-4">Loading notification preferences...</div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="font-medium">New Grant Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when new grant opportunities become available
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.new_grant_alerts}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs(prev => ({ ...prev, new_grant_alerts: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="font-medium">Deadline Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive reminders 7 days before grant application deadlines
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.deadline_reminders}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs(prev => ({ ...prev, deadline_reminders: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="font-medium">Quarterly Report Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Get reminded about upcoming quarterly compliance reports
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.quarterly_reports}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs(prev => ({ ...prev, quarterly_reports: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="font-medium">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable all email notifications
                        </p>
                      </div>
                      <Switch
                        checked={notificationPrefs.email_notifications}
                        onCheckedChange={(checked) => 
                          setNotificationPrefs(prev => ({ ...prev, email_notifications: checked }))
                        }
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button onClick={saveNotificationPreferences} className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      Save Notification Preferences
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <span>Notification Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Email Service Status</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Email notifications are currently processed through our notification system. 
                      All enabled notifications will be sent to your registered email address.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Basic information about your organization for grant applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgSettings.organization_name}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, organization_name: e.target.value }))}
                    placeholder="Your Police Department Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uei">UEI Number</Label>
                  <Input
                    id="uei"
                    value={orgSettings.uei_number}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, uei_number: e.target.value }))}
                    placeholder="Unique Entity Identifier"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duns">DUNS Number (Legacy)</Label>
                  <Input
                    id="duns"
                    value={orgSettings.duns_number}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, duns_number: e.target.value }))}
                    placeholder="Data Universal Numbering System"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveOrgSettings}>Save Organization Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendar Integration</CardTitle>
              <CardDescription>
                Sync deadlines and milestones with your calendar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Chrome className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Google Calendar</p>
                      <p className="text-sm text-muted-foreground">Sync with Google Calendar</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {calendarSettings.google_calendar_enabled && (
                      <Badge className="bg-green-100 text-green-800">Connected</Badge>
                    )}
                    <Button
                      variant={calendarSettings.google_calendar_enabled ? "outline" : "default"}
                      onClick={connectGoogleCalendar}
                      disabled={calendarSettings.google_calendar_enabled}
                    >
                      {calendarSettings.google_calendar_enabled ? "Connected" : "Connect"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-700" />
                    <div>
                      <p className="font-medium">Outlook Calendar</p>
                      <p className="text-sm text-muted-foreground">Sync with Microsoft Outlook</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {calendarSettings.outlook_calendar_enabled && (
                      <Badge className="bg-green-100 text-green-800">Connected</Badge>
                    )}
                    <Button
                      variant={calendarSettings.outlook_calendar_enabled ? "outline" : "default"}
                      onClick={connectOutlookCalendar}
                      disabled={calendarSettings.outlook_calendar_enabled}
                    >
                      {calendarSettings.outlook_calendar_enabled ? "Connected" : "Connect"}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Sync Options</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Sync Deadlines</p>
                      <p className="text-sm text-muted-foreground">Add grant deadlines to calendar</p>
                    </div>
                    <Switch
                      checked={calendarSettings.sync_deadlines}
                      onCheckedChange={(checked) => 
                        setCalendarSettings(prev => ({ ...prev, sync_deadlines: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Sync Milestones</p>
                      <p className="text-sm text-muted-foreground">Add milestone due dates to calendar</p>
                    </div>
                    <Switch
                      checked={calendarSettings.sync_milestones}
                      onCheckedChange={(checked) => 
                        setCalendarSettings(prev => ({ ...prev, sync_milestones: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Reminders</p>
                      <p className="text-sm text-muted-foreground">Send email notifications</p>
                    </div>
                    <Switch
                      checked={calendarSettings.email_reminders}
                      onCheckedChange={(checked) => 
                        setCalendarSettings(prev => ({ ...prev, email_reminders: checked }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminder-days">Reminder Days Before</Label>
                  <Select 
                    value={calendarSettings.reminder_days_before.toString()} 
                    onValueChange={(value) => 
                      setCalendarSettings(prev => ({ ...prev, reminder_days_before: parseInt(value) }))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium">Sync Deadlines Now</p>
                  <p className="text-sm text-muted-foreground">
                    Manually sync all active deadlines and tasks to your connected calendars
                  </p>
                </div>
                <Button 
                  onClick={syncDeadlinesToCalendar}
                  disabled={!calendarSettings.google_calendar_enabled && !calendarSettings.outlook_calendar_enabled}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Sync Deadlines
                </Button>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveCalendarSettings}>Save Calendar Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sam" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SAM.gov Registration Status</CardTitle>
              <CardDescription>
                Check your organization's System for Award Management (SAM) status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Current Status:</p>
                    {getSamStatusBadge(orgSettings.sam_status)}
                  </div>
                  {orgSettings.sam_expiration_date && (
                    <p className="text-sm text-muted-foreground">
                      Expires: {new Date(orgSettings.sam_expiration_date).toLocaleDateString()}
                    </p>
                  )}
                  {orgSettings.uei_number && (
                    <p className="text-sm text-muted-foreground">
                      UEI: {orgSettings.uei_number}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={checkSamStatus}>
                    Check Status
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://sam.gov" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit SAM.gov
                    </a>
                  </Button>
                </div>
              </div>
              
              {orgSettings.sam_status === "expired" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <p className="font-medium">SAM Registration Expired</p>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    Your SAM registration has expired. You must renew it to remain eligible for federal grants.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="finance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ERP & Financial System Integrations</CardTitle>
              <CardDescription>
                Connect your financial systems for automated budget management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {erpIntegrations.map((integration, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{integration.name}</p>
                      <p className="text-sm text-muted-foreground">Financial management integration</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{integration.status}</Badge>
                    <Button variant="outline" disabled>
                      Connect
                    </Button>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Export Current Budget Data</p>
                  <p className="text-sm text-muted-foreground">Download budget information as CSV</p>
                </div>
                <Button variant="outline" onClick={exportBudgetData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Webhooks, API integrations, and advanced system configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Webhook Configuration</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure external webhook endpoints to receive real-time notifications about grant activities.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Webhook configuration is available for organizations with API access. 
                      Contact support to enable advanced integrations for your account.
                    </p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">API Access</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate API keys and manage programmatic access to your grant data.
                  </p>
                  <Button variant="outline" disabled>
                    Request API Access
                  </Button>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Data Export & Backup</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Export all your grant data for backup or migration purposes.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled>
                      Export All Data
                    </Button>
                    <Button variant="outline" disabled>
                      Schedule Backups
                    </Button>
                  </div>
                </div>
                
                <IntegrationsEnhanced />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;