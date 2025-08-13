import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { DollarSign, Upload, Edit, Trash2, FileText, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DocumentPreview } from '@/components/ui/DocumentPreview';
import { listDrawdowns as listDrawdownsService, createDrawdown as createDrawdownService } from '@/services/drawdowns';

interface DrawdownEntry {
  id: string;
  amount: number;
  date: string;
  purpose: string;
  file_url?: string;
  created_at: string;
  created_by: string;
}

interface EnhancedDrawdownTrackerProps {
  grantId: string;
  grantTitle: string;
  awardAmount: number;
  canEdit: boolean;
}

export function EnhancedDrawdownTracker({ grantId, grantTitle, awardAmount, canEdit }: EnhancedDrawdownTrackerProps) {
  const [drawdowns, setDrawdowns] = useState<DrawdownEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDrawdown, setEditingDrawdown] = useState<DrawdownEntry | null>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    file: null as File | null
  });

  useEffect(() => {
    fetchDrawdowns();
  }, [grantId]);

  // Realtime: auto-refresh when drawdowns change for this grant
  useEffect(() => {
    const channel = supabase
      .channel('public:grant_drawdowns')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grant_drawdowns', filter: `grant_id=eq.${grantId}` },
        () => {
          fetchDrawdowns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [grantId]);
  const fetchDrawdowns = async (): Promise<DrawdownEntry[]> => {
    try {
      const data = await listDrawdownsService(grantId);
      setDrawdowns(data || []);
      return (data as DrawdownEntry[]) || [];
    } catch (error) {
      console.error('Error fetching drawdowns:', error);
      toast({
        title: "Error",
        description: "Failed to load drawdown data",
        variant: "destructive"
      });
      return [] as DrawdownEntry[];
    } finally {
      setLoading(false);
    }
  };

  const totalDrawn = drawdowns.reduce((sum, d) => sum + Number(d.amount), 0);
  const remainingAmount = awardAmount - totalDrawn;
  const utilizationPercentage = awardAmount > 0 ? (totalDrawn / awardAmount) * 100 : 0;
  const isFullyDrawn = utilizationPercentage >= 100;

  const handleFileUpload = async (file: File): Promise<string | null> => {
    if (!file) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `drawdown-${grantId}-${Date.now()}.${fileExt}`;
      const filePath = `grant-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('grant-documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
      return null;
    }
  };

  const saveDrawdown = async () => {
    if (!formData.amount || !formData.date) {
      toast({
        title: "Error",
        description: "Amount and date are required",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      let fileUrl = null;
      if (formData.file) {
        fileUrl = await handleFileUpload(formData.file);
        if (!fileUrl) {
          setUploading(false);
          return;
        }
      }

      const drawdownData = {
        grant_id: grantId,
        amount: parseFloat(formData.amount),
        date: formData.date,
        purpose: formData.purpose,
        file_url: fileUrl,
        created_by: user?.id
      };

      if (editingDrawdown) {
        const { error } = await supabase
          .from('grant_drawdowns')
          .update(drawdownData)
          .eq('id', editingDrawdown.id);
        if (error) throw error;
        toast({ title: "Success", description: "Drawdown updated successfully" });
      } else {
        await createDrawdownService({
          grant_id: drawdownData.grant_id,
          amount: drawdownData.amount,
          date: drawdownData.date,
          purpose: drawdownData.purpose,
          file_url: drawdownData.file_url || null,
        });
        toast({ title: "Success", description: "Drawdown added successfully" });
      }

      const updated = await fetchDrawdowns();
      const newTotal = updated.reduce((sum, d) => sum + Number(d.amount), 0);
      const utilization = awardAmount > 0 ? (newTotal / awardAmount) * 100 : 0;
      if (utilization > 100) {
        toast({
          title: "Overdrawn",
          description: "Total drawdowns exceed the awarded amount.",
          variant: "destructive",
        });
      } else if (utilization >= 90) {
        toast({
          title: "Warning",
          description: `Drawdowns have reached ${utilization.toFixed(1)}% of the award amount`,
        });
      }

      resetForm();
      setShowDialog(false);
    } catch (error) {
      console.error('Error saving drawdown:', error);
      toast({ title: "Error", description: "Failed to save drawdown", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteDrawdown = async (id: string) => {
    try {
      const { error } = await supabase
        .from('grant_drawdowns')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchDrawdowns();
      toast({
        title: "Success",
        description: "Drawdown deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting drawdown:', error);
      toast({
        title: "Error",
        description: "Failed to delete drawdown",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      purpose: '',
      file: null
    });
    setEditingDrawdown(null);
  };

  const startEdit = (drawdown: DrawdownEntry) => {
    setEditingDrawdown(drawdown);
    setFormData({
      amount: drawdown.amount.toString(),
      date: drawdown.date,
      purpose: drawdown.purpose || '',
      file: null
    });
    setShowDialog(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Drawdown Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Award</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${awardAmount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Drawn</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDrawn.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {utilizationPercentage.toFixed(1)}% of total award
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${remainingAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Available to draw
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {isFullyDrawn ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-orange-600" />
            )}
          </CardHeader>
          <CardContent>
            <Badge variant={isFullyDrawn ? "default" : "secondary"} className={isFullyDrawn ? "bg-green-600" : ""}>
              {isFullyDrawn ? "Award Fully Drawn" : "Active"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Drawdown Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Drawdown History</CardTitle>
            {canEdit && (
              <Dialog open={showDialog} onOpenChange={(open) => {
                setShowDialog(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Drawdown
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingDrawdown ? 'Edit Drawdown' : 'Add New Drawdown'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({...prev, amount: e.target.value}))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({...prev, date: e.target.value}))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="purpose">Purpose/Justification</Label>
                      <Textarea
                        id="purpose"
                        placeholder="Description of what this drawdown covers..."
                        value={formData.purpose}
                        onChange={(e) => setFormData(prev => ({...prev, purpose: e.target.value}))}
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="file">Documentation</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                        onChange={(e) => setFormData(prev => ({...prev, file: e.target.files?.[0] || null}))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, Excel, or image files only
                      </p>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveDrawdown} disabled={uploading}>
                        {uploading ? 'Saving...' : editingDrawdown ? 'Update' : 'Add'} Drawdown
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {drawdowns.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No drawdowns recorded</h3>
              <p className="text-muted-foreground">
                {canEdit ? 'Click "New Drawdown" to add your first entry.' : 'No drawdown history available.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Documentation</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawdowns.map((drawdown) => (
                  <TableRow key={drawdown.id}>
                    <TableCell>
                      {format(new Date(drawdown.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${Number(drawdown.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {drawdown.purpose || 'No purpose specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {drawdown.file_url ? (
                        <DocumentPreview 
                          fileUrl={drawdown.file_url}
                          fileName={`drawdown-${format(new Date(drawdown.date), 'yyyy-MM-dd')}.pdf`}
                        >
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-1" />
                            View File
                          </Button>
                        </DocumentPreview>
                      ) : (
                        <span className="text-muted-foreground">No file</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              ⋮
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEdit(drawdown)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteDrawdown(drawdown.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}