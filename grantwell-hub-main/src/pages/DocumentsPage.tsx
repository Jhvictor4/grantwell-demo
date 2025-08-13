import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { DocumentsManager } from '@/components/DocumentsManager';
import { useAuth } from '@/lib/auth';
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar,
  Folder,
  Star,
  Clock,
  Users,
  AlertCircle
} from 'lucide-react';

const DocumentsPage = () => {
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Restrict access to admin users for the manager tab
  const isAdmin = userRole === 'admin';

  // Mock document data
  const documents = [
    {
      id: '1',
      name: 'BJA Grant Application 2024.pdf',
      type: 'application',
      size: '2.4 MB',
      lastModified: '2024-01-15',
      status: 'submitted',
      grant: 'Edward Byrne Memorial JAG',
      category: 'Grant Applications'
    },
    {
      id: '2',
      name: 'Budget Narrative Q1 2024.docx',
      type: 'budget',
      size: '1.8 MB',
      lastModified: '2024-01-12',
      status: 'draft',
      grant: 'COPS Office Community Policing',
      category: 'Financial Documents'
    },
    {
      id: '3',
      name: 'Equipment Purchase Report.pdf',
      type: 'report',
      size: '3.1 MB',
      lastModified: '2024-01-10',
      status: 'approved',
      grant: 'Research and Development',
      category: 'Reports'
    },
    {
      id: '4',
      name: 'Training Program Outcomes.xlsx',
      type: 'data',
      size: '856 KB',
      lastModified: '2024-01-08',
      status: 'review',
      grant: 'Edward Byrne Memorial JAG',
      category: 'Compliance'
    }
  ];

  const categories = [
    { id: 'all', name: 'All Documents', count: documents.length },
    { id: 'applications', name: 'Grant Applications', count: 1 },
    { id: 'financial', name: 'Financial Documents', count: 1 },
    { id: 'reports', name: 'Reports', count: 1 },
    { id: 'compliance', name: 'Compliance', count: 1 }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'review': return 'bg-orange-100 text-orange-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'application': return <FileText className="h-5 w-5 text-blue-600" />;
      case 'budget': return <FileText className="h-5 w-5 text-green-600" />;
      case 'report': return <FileText className="h-5 w-5 text-purple-600" />;
      case 'data': return <FileText className="h-5 w-5 text-orange-600" />;
      default: return <FileText className="h-5 w-5 text-slate-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Document Center</h1>
            </div>
            <p className="text-slate-600 text-sm md:text-base">
              Manage All Your Grant-Related Documents In One Secure Location
            </p>
          </div>
          
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="overview">
              <Folder className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="manager">
                <FileText className="h-4 w-4 mr-2" />
                Document Manager
              </TabsTrigger>
            )}
            <TabsTrigger value="recent">
              <Clock className="h-4 w-4 mr-2" />
              Recent Activity
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Documents</p>
                      <p className="text-2xl font-bold text-slate-900">{documents.length}</p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Pending Review</p>
                      <p className="text-2xl font-bold text-slate-900">2</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Storage Used</p>
                      <p className="text-2xl font-bold text-slate-900">8.1 GB</p>
                    </div>
                    <Folder className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Active Grants</p>
                      <p className="text-2xl font-bold text-slate-900">3</p>
                    </div>
                    <Star className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Categories */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900">Document Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.slice(1).map((category) => (
                    <div key={category.id} className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-900">{category.name}</h4>
                        <Badge variant="secondary">{category.count}</Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        Manage {category.name.toLowerCase()} for all your grants
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Access */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900">Quick Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.slice(0, 4).map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                      {getDocumentIcon(doc.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{doc.name}</p>
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <span>{doc.grant}</span>
                          <Badge className={`text-xs ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Manager Tab - Admin Only */}
          {isAdmin && (
            <TabsContent value="manager" className="space-y-6">
              <DocumentsManager />
            </TabsContent>
          )}

          {/* Recent Activity Tab */}
          <TabsContent value="recent" className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900">Recent Document Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: 'uploaded', doc: 'BJA Grant Application 2024.pdf', user: 'John Smith', time: '2 hours ago' },
                    { action: 'reviewed', doc: 'Budget Narrative Q1 2024.docx', user: 'Sarah Johnson', time: '4 hours ago' },
                    { action: 'approved', doc: 'Equipment Purchase Report.pdf', user: 'Mike Wilson', time: '1 day ago' },
                    { action: 'submitted', doc: 'Training Program Outcomes.xlsx', user: 'John Smith', time: '2 days ago' }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg">
                      <div className="p-2 bg-slate-100 rounded-full">
                        {activity.action === 'uploaded' && <Upload className="h-4 w-4 text-blue-600" />}
                        {activity.action === 'reviewed' && <Eye className="h-4 w-4 text-orange-600" />}
                        {activity.action === 'approved' && <Users className="h-4 w-4 text-green-600" />}
                        {activity.action === 'submitted' && <FileText className="h-4 w-4 text-purple-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {activity.user} {activity.action} {activity.doc}
                        </p>
                        <p className="text-sm text-slate-600">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DocumentsPage;