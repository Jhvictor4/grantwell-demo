import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarDays, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, parseISO } from 'date-fns';
import { listEvents, generateEvents, markSubmitted } from '@/services/compliance';

interface QuarterlyComplianceProps {
  grantId: string;
  grantTitle: string;
  awardDate: string;
  canEdit: boolean;
  narrativeCadence?: 'quarterly' | 'semiannual';
}

interface ComplianceEventRow {
  id: string;
  type: 'SF-425' | 'Narrative';
  due_on: string;
  status: 'Due' | 'Submitted' | 'Late';
  submitted_on?: string | null;
}

export function QuarterlyCompliance({
  grantId,
  grantTitle,
  awardDate,
  canEdit,
  narrativeCadence = 'quarterly'
}: QuarterlyComplianceProps) {
  const [events, setEvents] = useState<ComplianceEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    init();
  }, [grantId, awardDate, narrativeCadence]);

  const init = async () => {
    if (!awardDate) return;
    try {
      setLoading(true);
      // Ensure events exist
      await generateEvents({
        grant_id: grantId,
        award_start: awardDate,
        narrativeCadence
      });
      // Load events
      const all = await listEvents(grantId);
      // Only show SF-425 and Narrative for now
      const filtered = (all || [])
        .filter(e => e.type === 'SF-425' || e.type === 'Narrative')
        .map(e => ({
          id: e.id!,
          type: e.type as 'SF-425' | 'Narrative',
          due_on: e.due_on,
          status: (e.status as ComplianceEventRow['status']) || 'Due',
          submitted_on: (e as any).submitted_on || null
        }))
        .sort((a, b) => a.due_on.localeCompare(b.due_on));
      setEvents(filtered);
    } catch (error: any) {
      console.error('Compliance init error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to load compliance events', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ComplianceEventRow['status']) => {
    switch (status) {
      case 'Submitted':
        return 'bg-green-100 text-green-800';
      case 'Late':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusChange = async (eventId: string, value: ComplianceEventRow['status']) => {
    try {
      if (value === 'Submitted') {
        await markSubmitted(eventId);
        toast({ title: 'Updated', description: 'Marked as submitted' });
      }
      await init();
    } catch (error: any) {
      console.error('Update status error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to update status', variant: 'destructive' });
    }
  };

  const overdue = events.find(
    (e) => e.status !== 'Submitted' && isAfter(new Date(), parseISO(e.due_on))
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Quarterly Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Quarterly Compliance (SF-425 & Narrative)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdue && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Overdue:</strong> {overdue.type} was due on {format(parseISO(overdue.due_on), 'MMM dd, yyyy')}
            </AlertDescription>
          </Alert>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.slice(0, 8).map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="font-medium">{ev.type}</TableCell>
                <TableCell>{format(parseISO(ev.due_on), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(ev.status)}>
                    {ev.status}
                  </Badge>
                  {ev.status === 'Submitted' && ev.submitted_on && (
                    <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {format(parseISO(ev.submitted_on), 'MMM dd, yyyy')}
                    </span>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Select
                      value={ev.status}
                      onValueChange={(value) => handleStatusChange(ev.id, value as ComplianceEventRow['status'])}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Due">Due</SelectItem>
                        <SelectItem value="Submitted">Submitted</SelectItem>
                        <SelectItem value="Late">Late</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
