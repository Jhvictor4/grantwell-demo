import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SystemRole, GrantRole } from '@/lib/permissions';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';
import { 
  Folder, 
  FolderPlus, 
  Upload, 
  File, 
  Download, 
  Trash2, 
  Eye,
  Plus,
  Search,
  Grid3X3,
  List
} from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  created_by: string;
  grant_id: string;
  updated_at: string;
}

interface Document {
  id: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  folder_id?: string;
  uploaded_by: string;
  upload_date: string;
  file_path: string;
}

interface GrantWorkspaceAttachmentsProps {
  grantId: string;
  userRole: SystemRole;
  grantRole?: GrantRole;
  isOwner?: boolean;
  title?: string;
  linkedFeature?: string;
}

export function GrantWorkspaceAttachments({ 
  grantId, 
  userRole, 
  grantRole, 
  isOwner,
  title = 'Attachments',
  linkedFeature = 'attachments'
}: GrantWorkspaceAttachmentsProps) {
  const { toast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const canEdit = userRole === 'admin' || userRole === 'manager' || 
                  grantRole === 'coordinator' || grantRole === 'contributor' || 
                  isOwner;

  const canView = canEdit || grantRole === 'reviewer' || grantRole === 'observer';

  useEffect(() => {
    if (grantId && canView) {
      loadFoldersAndDocuments();
    }
  }, [grantId, currentFolderId, canView]);

  const loadFoldersAndDocuments = async () => {
    try {
      setLoading(true);
      
      // Load folders
      const folderQuery = supabase
        .from('document_folders')
        .select('*')
        .eq('grant_id', grantId)
        .order('name');
      
      if (currentFolderId) {
        folderQuery.eq('parent_id', currentFolderId);
      } else {
        folderQuery.is('parent_id', null);
      }
      
      const { data: foldersData, error: foldersError } = await folderQuery;

      if (foldersError) throw foldersError;

      // Load documents
      const docQuery = supabase
        .from('contextual_documents')
        .select('*')
        .eq('grant_id', grantId)
        .eq('linked_feature', linkedFeature)
        .order('original_name');
        
      if (currentFolderId) {
        docQuery.eq('folder_id', currentFolderId);
      } else {
        docQuery.is('folder_id', null);
      }
      
      const { data: docsData, error: docsError } = await docQuery;

      if (docsError) throw docsError;

      setFolders((foldersData as Folder[]) || []);
      setDocuments((docsData as Document[]) || []);
    } catch (error) {
      console.error('Error loading attachments:', error);
      toast({
        title: "Error",
        description: "Failed to load attachments.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a folder name.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('document_folders')
        .insert({
          name: newFolderName.trim(),
          grant_id: grantId,
          parent_id: currentFolderId,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      await logGrantActivityWithDescription(
        grantId,
        'folder_created',
        `created folder "${newFolderName}"`,
        { folder_name: newFolderName, parent_folder_id: currentFolderId }
      );

      if (linkedFeature === 'compliance') {
        await supabase.from('compliance_logs').insert({
          grant_id: grantId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          activity_description: `Created folder "${newFolderName}"`,
          status: 'logged'
        });
      }

      toast({
        title: "Folder Created",
        description: `Folder "${newFolderName}" has been created.`
      });

      setNewFolderName('');
      setShowNewFolderDialog(false);
      loadFoldersAndDocuments();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: "Error",
        description: "Failed to create folder.",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `grant-documents/${grantId}/${fileName}`;

        // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save metadata to database
        const { error: dbError } = await supabase
          .from('contextual_documents')
          .insert({
            file_name: fileName,
            original_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            file_path: filePath,
            grant_id: grantId,
            folder_id: currentFolderId,
            linked_feature: linkedFeature,
            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
            upload_date: new Date().toISOString()
          });

        if (dbError) throw dbError;

        await logGrantActivityWithDescription(
          grantId,
          'file_uploaded',
          `uploaded file "${file.name}"`,
          { file_name: file.name, file_size: file.size, folder_id: currentFolderId }
        );

        if (linkedFeature === 'compliance') {
          await supabase.from('compliance_logs').insert({
            grant_id: grantId,
            created_by: (await supabase.auth.getUser()).data.user?.id,
            activity_description: `Uploaded file "${file.name}"`,
            status: 'logged'
          });
        }
      }

      toast({
        title: "Files Uploaded",
        description: `${files.length} file(s) uploaded successfully.`
      });

      loadFoldersAndDocuments();
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: "Failed to upload files.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }; 

  const handleDocumentDragStart = (e: React.DragEvent, documentId: string) => {
    e.dataTransfer.setData('text/plain', documentId);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = () => setDragOverFolderId(null);

  const moveDocumentToFolder = async (documentId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('contextual_documents')
        .update({ folder_id: folderId })
        .eq('id', documentId);
      if (error) throw error;
      loadFoldersAndDocuments();
      toast({ title: 'Moved', description: 'Document moved successfully.' });
    } catch (err) {
      console.error('Error moving document:', err);
      toast({ title: 'Error', description: 'Failed to move document.', variant: 'destructive' });
    } finally {
      setDragOverFolderId(null);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const documentId = e.dataTransfer.getData('text/plain');
    if (documentId) moveDocumentToFolder(documentId, folderId);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const documentId = e.dataTransfer.getData('text/plain');
    if (documentId) moveDocumentToFolder(documentId, null);
  };

  const downloadFile = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('grant-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.original_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await logGrantActivityWithDescription(
        grantId,
        'file_downloaded',
        `downloaded file "${document.original_name}"`,
        { file_name: document.original_name, document_id: document.id }
      );
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file.",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter(doc =>
    doc.original_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canView) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
        <p className="text-muted-foreground">
          You don't have permission to view attachments for this grant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground">
            Organize and manage files for this grant
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
            <Button asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files and folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      {currentFolderId && (
        <div className="flex items-center gap-2 text-sm" onDragOver={handleRootDrop} onDrop={handleRootDrop}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentFolderId(null)}
          >
            Root
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Current Folder</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-8">Loading attachments...</div>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Folders */}
          {filteredFolders.map((folder) => (
            <Card 
              key={folder.id} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${dragOverFolderId === folder.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setCurrentFolderId(folder.id)}
              onDragOver={(e) => handleFolderDragOver(e, folder.id)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Folder className="h-8 w-8 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{folder.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(folder.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Documents */}
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow" draggable onDragStart={(e) => handleDocumentDragStart(e, document.id)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <File className="h-8 w-8 text-gray-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{document.original_name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(document.file_size)} • {new Date(document.upload_date).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(document)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredFolders.length === 0 && filteredDocuments.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No files or folders</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No items match your search." : "Start by creating a folder or uploading files."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowNewFolderDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={createFolder}>
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}