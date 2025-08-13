import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  FileCheck, 
  Upload, 
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Folder,
  Plus,
  Eye
} from 'lucide-react';

import { FilePreviewModal } from '@/components/ui/file-preview-modal';

import { hasPermission, SystemRole, GrantRole } from '@/lib/permissions';
import { SecurityBadge } from '../SecurityBadge';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';

interface ComplianceItem {
  id: string;
  item_name: string;
  is_complete: boolean;
  due_date?: string;
  completed_by?: string;
  notes?: string;
  file_url?: string;
}

interface ComplianceFolder {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  created_by: string;
}

interface GrantWorkspaceComplianceProps {
  grantId: string;
  userRole: SystemRole;
  grantRole?: GrantRole;
  isOwner?: boolean;
}

export function GrantWorkspaceCompliance({ 
  grantId, 
  userRole, 
  grantRole, 
  isOwner = false 
}: GrantWorkspaceComplianceProps) {
  const { toast } = useToast();
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [folders, setFolders] = useState<ComplianceFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const canEdit = hasPermission('edit:compliance', userRole, grantRole, isOwner);

  useEffect(() => {
    if (grantId) {
      loadComplianceData();
    }
  }, [grantId]);

  const loadComplianceData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadComplianceItems(),
        loadFolders()
      ]);
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComplianceItems = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_checklist')
        .select('*')
        .eq('grant_id', grantId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error loading compliance items:', error);
        return;
      }

      if (!data || data.length === 0) {
        // Create default compliance items
        await createDefaultComplianceItems();
      } else {
        setComplianceItems(data);
      }
    } catch (error) {
      console.error('Error loading compliance items:', error);
    }
  };

  const loadFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('document_folders')
        .select('*')
        .eq('grant_id', grantId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading folders:', error);
        return;
      }

      setFolders(data || []);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const createDefaultComplianceItems = async () => {
    if (!canEdit) return;

    const defaultItems = [
      { name: 'Progress Reports', order: 1, required: true },
      { name: 'Subrecipient Documentation', order: 2, required: true },
      { name: 'Audit Logs', order: 3, required: true },
      { name: 'Financial Compliance Review', order: 4, required: true },
      { name: 'Environmental Compliance', order: 5, required: false },
      { name: 'Civil Rights Compliance', order: 6, required: true },
      { name: 'Equipment Inventory', order: 7, required: false },
      { name: 'Personnel Files Review', order: 8, required: true },
    ];

    try {
      const { data, error } = await supabase
        .from('compliance_checklist')
        .insert(
          defaultItems.map((item) => ({
            grant_id: grantId,
            item_name: item.name,
            order_index: item.order,
            is_complete: false,
            is_custom: false,
          }))
        )
        .select();

      if (error) throw error;

      // Mirror each item to compliance_logs for consistency
      for (const item of defaultItems) {
        await supabase
          .from('compliance_logs')
          .insert({
            grant_id: grantId,
            log_type: 'checklist_created',
            activity_description: `Created compliance checklist item: ${item.name}`,
            status: 'logged'
          });
      }

      setComplianceItems(data || []);
    } catch (error) {
      console.error('Error creating default compliance items:', error);
    }
  };

  const createFolder = async () => {
    if (!canEdit || !newFolderName.trim()) return;

    try {
      setCreatingFolder(true);
      
      const { data, error } = await supabase
        .from('document_folders')
        .insert({
          grant_id: grantId,
          name: newFolderName.trim(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Mirror to compliance_logs
      await supabase
        .from('compliance_logs')
        .insert({
          grant_id: grantId,
          log_type: 'folder_created',
          activity_description: `Created compliance folder: ${newFolderName.trim()}`,
          status: 'logged'
        });

      await logGrantActivityWithDescription(
        grantId,
        'item_created',
        `created compliance folder "${newFolderName.trim()}"`,
        { folder_name: newFolderName.trim() }
      );

      setFolders(prev => [...prev, data]);
      setNewFolderName('');
      
      toast({
        title: 'Folder Created',
        description: 'Compliance folder has been created successfully',
      });
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create folder',
        variant: 'destructive',
      });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFileUpload = async (itemId: string, file: File) => {
    if (!canEdit) return;

    try {
      setUploading(itemId);
      
      // Get the compliance item to determine folder structure
      const complianceItem = complianceItems.find(item => item.id === itemId);
      const itemName = complianceItem?.item_name || 'General';
      
      // Create compliance folder structure in attachments
      const folderName = `Compliance/${itemName}`;
      
      // First, ensure the Compliance parent folder exists
      let parentFolderId = null;
      const { data: existingParentFolder } = await supabase
        .from('document_folders')
        .select('id')
        .eq('grant_id', grantId)
        .eq('name', 'Compliance')
        .is('parent_id', null)
        .maybeSingle();

      if (!existingParentFolder) {
        // Create parent Compliance folder
        const { data: newParentFolder, error: parentError } = await supabase
          .from('document_folders')
          .insert({
            grant_id: grantId,
            name: 'Compliance',
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();

        if (parentError) throw parentError;
        parentFolderId = newParentFolder.id;
      } else {
        parentFolderId = existingParentFolder.id;
      }

      // Now ensure the specific compliance item subfolder exists
      let subfolderId = null;
      const { data: existingSubfolder } = await supabase
        .from('document_folders')
        .select('id')
        .eq('grant_id', grantId)
        .eq('name', itemName)
        .eq('parent_id', parentFolderId)
        .maybeSingle();

      if (!existingSubfolder) {
        // Create subfolder for this compliance item
        const { data: newSubfolder, error: subfolderError } = await supabase
          .from('document_folders')
          .insert({
            grant_id: grantId,
            name: itemName,
            parent_id: parentFolderId,
            created_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();

        if (subfolderError) throw subfolderError;
        subfolderId = newSubfolder.id;
      } else {
        subfolderId = existingSubfolder.id;
      }
      
      // Upload file to Supabase storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `compliance/${grantId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('grant-documents')
        .getPublicUrl(filePath);

      // Store file reference in contextual_documents with proper folder organization
      const { error: docError } = await supabase
        .from('contextual_documents')
        .insert({
          file_name: fileName,
          original_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          file_path: filePath,
          grant_id: grantId,
          folder_id: subfolderId,
          linked_feature: 'compliance',
          linked_entity_id: itemId,
          description: `Compliance document for ${itemName}`,
          upload_date: new Date().toISOString(),
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (docError) throw docError;

      // Note: We don't update the compliance_checklist table with file_url anymore
      // Files are managed through contextual_documents and organized in folders

      // Mirror to compliance_logs with improved description
      await supabase
        .from('compliance_logs')
        .insert({
          grant_id: grantId,
          log_type: 'document_upload',
          activity_description: `Uploaded ${file.name} to ${itemName}`,
          attachment_url: urlData.publicUrl,
          status: 'logged'
        });

      await logGrantActivityWithDescription(
        grantId,
        'file_uploaded',
        `uploaded ${file.name} to Compliance/${itemName}`,
        { 
          file_name: file.name, 
          compliance_section: itemName,
          folder_path: folderName
        }
      );

      toast({
        title: 'Success',
        description: `File uploaded to Compliance/${itemName} folder`,
      });

      loadComplianceItems();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const updateItemStatus = async (itemId: string, completed: boolean) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('compliance_checklist')
        .update({ 
          is_complete: completed,
          completed_by: completed ? (await supabase.auth.getUser()).data.user?.email : null
        })
        .eq('id', itemId);

      if (error) throw error;

      // Mirror to compliance_logs
      const item = complianceItems.find(i => i.id === itemId);
      await supabase
        .from('compliance_logs')
        .insert({
          grant_id: grantId,
          log_type: 'status_update',
          activity_description: `Marked compliance item "${item?.item_name}" as ${completed ? 'complete' : 'incomplete'}`,
          status: 'logged'
        });

      await logGrantActivityWithDescription(
        grantId,
        'compliance_updated',
        `marked compliance item as ${completed ? 'complete' : 'incomplete'}`,
        { item_name: item?.item_name, completed }
      );

      setComplianceItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { ...item, is_complete: completed }
            : item
        )
      );

      toast({
        title: 'Updated',
        description: `Compliance item marked as ${completed ? 'complete' : 'incomplete'}`,
      });
    } catch (error: any) {
      console.error('Error updating compliance item:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update item',
        variant: 'destructive',
      });
    }
  };

  const getCompletionRate = () => {
    if (complianceItems.length === 0) return 0;
    const completed = complianceItems.filter(item => item.is_complete).length;
    return Math.round((completed / complianceItems.length) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasPermission('view:compliance', userRole, grantRole, isOwner)) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You do not have permission to view the compliance section.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Compliance Management</h2>
          <p className="text-muted-foreground">
            Track compliance requirements and upload documents. All files are organized in the Attachments tab under Compliance folders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {getCompletionRate()}% Complete
          </Badge>
        </div>
      </div>

      {/* Compliance Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <span>{complianceItems.filter(i => i.is_complete).length} of {complianceItems.length} items complete</span>
            </div>
            <Progress value={getCompletionRate()} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Compliance Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  checked={item.is_complete}
                  onCheckedChange={(checked) => updateItemStatus(item.id, checked as boolean)}
                  disabled={!canEdit}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-medium ${item.is_complete ? 'line-through text-muted-foreground' : ''}`}>
                      {item.item_name}
                    </h4>
                    {item.is_complete && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </div>
                  
                  {item.due_date && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      Due: {new Date(item.due_date).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id={`file-${item.id}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(item.id, file);
                          }}
                          disabled={uploading === item.id}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => document.getElementById(`file-${item.id}`)?.click()}
                          disabled={uploading === item.id}
                          title="Files will be organized in Attachments tab under Compliance folders"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {uploading === item.id ? 'Uploading...' : 'Upload to Attachments'}
                        </Button>
                      </div>
                    )}
                    
                    {/* Show file status and preview based on contextual_documents */}
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        Files uploaded to Compliance/{item.item_name} folder in Attachments tab
                      </div>
                      {item.file_url && (
                        <FilePreviewModal
                          fileName={`${item.item_name}.pdf`}
                          fileUrl={item.file_url}
                          fileType="application/pdf"
                          status="logged"
                          onStatusChange={(status) => console.log('Status changed:', status)}
                          onDownload={() => console.log('Downloaded')}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </FilePreviewModal>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Folder Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Compliance Folders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Create New Folder */}
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  disabled={creatingFolder}
                />
                <Button
                  onClick={createFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Folder
                </Button>
              </div>
            )}

            {/* Folder List */}
            <div className="space-y-2">
              {folders.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No folders created yet
                </div>
              ) : (
                folders.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-2 p-2 border rounded">
                    <Folder className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{folder.name}</span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {new Date(folder.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}