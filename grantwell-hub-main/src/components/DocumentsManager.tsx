import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Filter, Search, Upload, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BulkUploadPanel } from '@/components/BulkUploadPanel';
import { confirmAction } from '@/lib/ui/confirm';

const DOJ_CATEGORIES = [
  'Award Documents',
  'Progress Reports',
  'Financial (SF-425)',
  'Drawdowns',
  'Match',
  'Subrecipients',
  'Closeout'
] as const;

interface DocumentRecord {
  id: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  linked_feature: string;
  linked_entity_id?: string;
  upload_date: string;
  description?: string;
  tags?: string[];
  department?: string;
  grant_id?: string;
  uploaded_by: string;
  uploader_email?: string;
}

export function DocumentsManager() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [featureFilter, setFeatureFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contextual_documents')
        .select('*')
        .eq('is_active', true)
        .order('upload_date', { ascending: false });

      if (error) {
        console.error('Error loading documents:', error);
        toast({
          title: "Error",
          description: "Failed to load documents",
          variant: "destructive"
        });
        return;
      }

      const documentsWithUploader = data?.map(doc => ({
        ...doc,
        uploader_email: 'Unknown' // Will be enhanced later with proper join
      })) || [];

      setDocuments(documentsWithUploader);
    } catch (error) {
      console.error('Load documents error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (documentId: string, category: string) => {
    try {
      const { error } = await supabase
        .from('contextual_documents')
        .update({ department: category })
        .eq('id', documentId);

      if (error) throw error;

      setDocuments(prev => prev.map(d => d.id === documentId ? { ...d, department: category } : d));
      toast({ title: 'Updated', description: 'Category updated successfully' });
    } catch (error) {
      console.error('Update category error:', error);
      toast({ title: 'Update failed', description: 'Could not update category', variant: 'destructive' });
    }
  };

  const handleFileDownload = async (doc: DocumentRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from('contextual-documents')
        .download(doc.file_name);

      if (error) {
        console.error('Download error:', error);
        toast({
          title: "Download failed",
          description: "Failed to download file",
          variant: "destructive"
        });
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download process error:', error);
      toast({
        title: "Download failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleFileDelete = async (documentId: string) => {
    const confirmed = await confirmAction({
      title: 'Delete document?',
      description: 'Are you sure you want to delete this document? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    try {
      const documentToDelete = documents.find(d => d.id === documentId);
      if (!documentToDelete) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('contextual-documents')
        .remove([documentToDelete.file_name]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('contextual_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        toast({
          title: "Delete failed",
          description: "Failed to delete document",
          variant: "destructive"
        });
        return;
      }

      setDocuments(prev => prev.filter(d => d.id !== documentId));
      toast({
        title: "Document deleted",
        description: "Document removed successfully"
      });

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: "An unexpected error occurred",
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText className="h-4 w-4 text-green-500" />;
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const getFeatureBadgeColor = (feature: string) => {
    switch (feature) {
      case 'narrative': return 'bg-blue-100 text-blue-800';
      case 'report': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter documents based on search and filters
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchTerm === '' || 
      doc.original_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.uploader_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFeature = featureFilter === 'all' || doc.linked_feature === featureFilter;
    const matchesDepartment = departmentFilter === 'all' || doc.department === departmentFilter;

    let matchesDate = true;
    if (dateRange !== 'all') {
      const uploadDate = new Date(doc.upload_date);
      const now = new Date();
      
      switch (dateRange) {
        case 'week':
          matchesDate = (now.getTime() - uploadDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
          break;
        case 'month':
          matchesDate = (now.getTime() - uploadDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
          break;
        case 'quarter':
          matchesDate = (now.getTime() - uploadDate.getTime()) <= 90 * 24 * 60 * 60 * 1000;
          break;
      }
    }

    return matchesSearch && matchesFeature && matchesDepartment && matchesDate;
  });

  // Get unique values for filters
  const uniqueFeatures = [...new Set(documents.map(d => d.linked_feature))];
  const uniqueDepartments = [...new Set(documents.map(d => d.department).filter(Boolean))];

  // Group documents by feature for summary
  const documentsByFeature = filteredDocuments.reduce((acc, doc) => {
    acc[doc.linked_feature] = (acc[doc.linked_feature] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">All Documents</h2>
          <p className="text-muted-foreground">
            Manage all uploaded documents across the system
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowBulkUpload(true)} 
            variant="outline"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={loadDocuments} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{filteredDocuments.length}</div>
            <div className="text-sm text-muted-foreground">Total Documents</div>
          </CardContent>
        </Card>
        {Object.entries(documentsByFeature).map(([feature, count]) => (
          <Card key={feature}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-muted-foreground capitalize">{feature} Documents</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Feature</label>
              <Select value={featureFilter} onValueChange={setFeatureFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All features" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Features</SelectItem>
                  {uniqueFeatures.map(feature => (
                    <SelectItem key={feature} value={feature} className="capitalize">
                      {feature}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {uniqueDepartments.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="quarter">Last Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center p-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No documents found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>DOJ Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getFileIcon(doc.mime_type)}
                        <div>
                          <div className="font-medium truncate max-w-xs" title={doc.original_name}>
                            {doc.original_name}
                          </div>
                          {doc.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-xs">
                              {doc.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getFeatureBadgeColor(doc.linked_feature)}>
                        {doc.linked_feature}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={doc.department || ''} onValueChange={(v) => handleUpdateCategory(doc.id, v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOJ_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatFileSize(doc.file_size)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {doc.uploader_email}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(doc.upload_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFileDownload(doc)}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFileDelete(doc.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {showBulkUpload && (
        <BulkUploadPanel 
          grantId="system" // For system-wide document management
          onClose={() => setShowBulkUpload(false)} 
        />
      )}
    </div>
  );
}