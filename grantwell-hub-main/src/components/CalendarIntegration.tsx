import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  ExternalLink, 
  Calendar as CalendarIcon, 
  Smartphone,
  Mail,
  Share,
  FileDown
} from 'lucide-react';

interface CalendarIntegrationProps {
  deadlines?: Array<{
    id: string;
    name: string;
    due_date: string;
    type: string;
    grants?: { title: string };
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    due_date: string;
    priority: string;
    grants?: { title: string };
  }>;
}

const CalendarIntegration = ({ deadlines = [], tasks = [] }: CalendarIntegrationProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const generateICSContent = () => {
    const now = new Date();
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Grantwell//Grant Management//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Grantwell Grant Calendar',
      'X-WR-CALDESC:Grant deadlines and tasks from Grantwell'
    ];

    // Add deadlines
    deadlines.forEach((deadline, index) => {
      const dueDate = new Date(deadline.due_date);
      const uid = `deadline-${deadline.id}@grantwell.app`;
      
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatDate(now)}`,
        `DTSTART;VALUE=DATE:${deadline.due_date.replace(/-/g, '')}`,
        `SUMMARY:${deadline.type.toUpperCase()}: ${deadline.name}`,
        `DESCRIPTION:Grant: ${deadline.grants?.title || 'Unknown'}\\nType: ${deadline.type}\\nDeadline for Grantwell grant management.`,
        'CATEGORIES:Grant,Deadline',
        'PRIORITY:5',
        'END:VEVENT'
      );
    });

    // Add tasks
    tasks.forEach((task, index) => {
      if (!task.due_date) return;
      
      const dueDate = new Date(task.due_date);
      const uid = `task-${task.id}@grantwell.app`;
      
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatDate(now)}`,
        `DTSTART;VALUE=DATE:${task.due_date.replace(/-/g, '')}`,
        `SUMMARY:TASK: ${task.title}`,
        `DESCRIPTION:Grant: ${task.grants?.title || 'No grant assigned'}\\nPriority: ${task.priority}\\nTask from Grantwell grant management.`,
        'CATEGORIES:Task,Grant',
        `PRIORITY:${task.priority === 'urgent' ? '1' : task.priority === 'high' ? '3' : '5'}`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
  };

  const downloadICSFile = () => {
    setIsExporting(true);
    try {
      const icsContent = generateICSContent();
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `grantwell-calendar-${new Date().toISOString().split('T')[0]}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Calendar Exported",
        description: "ICS file has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export calendar. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getGoogleCalendarUrl = () => {
    const allEvents = [...deadlines, ...tasks.filter(t => t.due_date)];
    if (allEvents.length === 0) return '';

    // For simplicity, create URL for the first deadline
    const firstDeadline = deadlines[0];
    if (!firstDeadline) return '';
    
    const date = firstDeadline.due_date;
    const title = firstDeadline.name;
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Grantwell: ${title}`,
      dates: `${date.replace(/-/g, '')}/${date.replace(/-/g, '')}`,
      details: `Grant management event from Grantwell`,
      location: 'Grantwell Platform'
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const getOutlookUrl = () => {
    const allEvents = [...deadlines, ...tasks.filter(t => t.due_date)];
    if (allEvents.length === 0) return '';

    // For simplicity, create URL for the first deadline
    const firstDeadline = deadlines[0];
    if (!firstDeadline) return '';
    
    const date = firstDeadline.due_date;
    const title = firstDeadline.name;
    
    const params = new URLSearchParams({
      subject: `Grantwell: ${title}`,
      startdt: `${date}T09:00:00.000Z`,
      enddt: `${date}T10:00:00.000Z`,
      body: `Grant management event from Grantwell`,
      location: 'Grantwell Platform'
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  const copyToClipboard = async () => {
    try {
      const icsContent = generateICSContent();
      await navigator.clipboard.writeText(icsContent);
      toast({
        title: "Copied to Clipboard",
        description: "Calendar data has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive"
      });
    }
  };

  const totalEvents = deadlines.length + tasks.filter(t => t.due_date).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <CalendarIcon className="h-6 w-6 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Calendar Integration</h3>
          <p className="text-sm text-slate-600">Export and sync your grant calendar</p>
        </div>
      </div>

      {/* Export Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{totalEvents}</p>
                <p className="text-xs text-slate-600">Total Events</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{deadlines.length}</p>
                <p className="text-xs text-slate-600">Deadlines</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{tasks.filter(t => t.due_date).length}</p>
                <p className="text-xs text-slate-600">Tasks</p>
              </div>
            </div>
            <Badge variant="secondary">Ready to Export</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Download ICS File */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <FileDown className="h-5 w-5 text-blue-600" />
              <span>Download ICS File</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Download a universal calendar file that works with most calendar applications.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">Outlook</Badge>
              <Badge variant="outline" className="text-xs">Apple Calendar</Badge>
              <Badge variant="outline" className="text-xs">Thunderbird</Badge>
            </div>
            <Button 
              onClick={downloadICSFile}
              disabled={isExporting || totalEvents === 0}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Generating...' : 'Download ICS File'}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Share className="h-5 w-5 text-green-600" />
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Quick export and sharing options for immediate use.
            </p>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                onClick={copyToClipboard}
                disabled={totalEvents === 0}
                className="w-full justify-start"
              >
                <Mail className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button 
                variant="outline"
                disabled={totalEvents === 0}
                className="w-full justify-start"
                onClick={() => window.open(getGoogleCalendarUrl(), '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Add to Google Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Smartphone className="h-5 w-5 text-purple-600" />
            <span>Mobile Calendar Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              For mobile devices, download the ICS file and open it with your device's calendar app.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-slate-900">iPhone/iPad</h4>
                <ol className="text-sm text-slate-600 space-y-1">
                  <li>1. Download ICS file</li>
                  <li>2. Open in Apple Calendar</li>
                  <li>3. Choose calendar to add events</li>
                </ol>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-slate-900">Android</h4>
                <ol className="text-sm text-slate-600 space-y-1">
                  <li>1. Download ICS file</li>
                  <li>2. Open with Google Calendar</li>
                  <li>3. Import events automatically</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {totalEvents === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-amber-800">
              <CalendarIcon className="h-5 w-5" />
              <span className="font-medium">No events to export</span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              Add deadlines or tasks with due dates to start using calendar integration.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalendarIntegration;