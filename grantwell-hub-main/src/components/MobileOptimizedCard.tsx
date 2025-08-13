import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  DollarSign, 
  ExternalLink, 
  MoreVertical,
  Bookmark,
  BookmarkCheck,
  Clock,
  Building
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMobileDetection } from '@/hooks/use-mobile-detection';

interface Grant {
  id: string;
  title: string;
  agency: string;
  funding_amount_min?: number;
  funding_amount_max?: number;
  deadline?: string;
  status: string;
  summary?: string;
  match_score?: number;
  is_bookmarked?: boolean;
  external_url?: string;
}

interface MobileOptimizedCardProps {
  grant: Grant;
  onBookmark?: (id: string) => void;
  onRemoveBookmark?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

const handleViewGrant = (grant: Grant) => {
  if (grant.external_url) {
    window.open(grant.external_url, '_blank');
  } else {
    // Fallback to internal details if no external URL
    window.open(`/grants/${grant.id}`, '_blank');
  }
};

export const MobileOptimizedCard: React.FC<MobileOptimizedCardProps> = ({
  grant,
  onBookmark,
  onRemoveBookmark,
  onViewDetails
}) => {
  const { isMobile } = useMobileDetection();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-600';
      case 'closing_soon': return 'bg-orange-600';
      case 'closed': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysRemaining = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (isMobile) {
    return (
      <Card className="w-full animate-fade-in">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <Badge 
                  variant="secondary" 
                  className={`text-xs text-white ${getStatusColor(grant.status)}`}
                >
                  {grant.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">
                {grant.title}
              </h3>
              <div className="flex items-center text-xs text-muted-foreground mb-2">
                <Building className="h-3 w-3 mr-1" />
                {grant.agency}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewGrant(grant)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Grants.gov
                </DropdownMenuItem>
                {grant.is_bookmarked ? (
                  <DropdownMenuItem onClick={() => onRemoveBookmark?.(grant.id)}>
                    <BookmarkCheck className="h-4 w-4 mr-2" />
                    Remove Bookmark
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onBookmark?.(grant.id)}>
                    <Bookmark className="h-4 w-4 mr-2" />
                    Bookmark
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Summary */}
          {grant.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {grant.summary}
            </p>
          )}

          {/* Funding & Deadline */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-4">
              {(grant.funding_amount_min || grant.funding_amount_max) && (
                <div className="flex items-center text-green-600">
                  <DollarSign className="h-3 w-3 mr-1" />
                  <span className="font-medium">
                    {grant.funding_amount_min && grant.funding_amount_max
                      ? `${formatCurrency(grant.funding_amount_min)} - ${formatCurrency(grant.funding_amount_max)}`
                      : formatCurrency(grant.funding_amount_max || grant.funding_amount_min || 0)
                    }
                  </span>
                </div>
              )}
              
              {grant.deadline && (
                <div className="flex items-center text-orange-600">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{getDaysRemaining(grant.deadline)}d left</span>
                </div>
              )}
            </div>
            
            {grant.is_bookmarked && (
              <BookmarkCheck className="h-4 w-4 text-green-600" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop view (existing card design)
  return (
    <Card className="hover-scale transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Badge 
                variant="secondary" 
                className={`text-white ${getStatusColor(grant.status)}`}
              >
                {grant.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <CardTitle className="text-lg leading-tight">{grant.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{grant.agency}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {grant.summary && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
            {grant.summary}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            {(grant.funding_amount_min || grant.funding_amount_max) && (
              <div className="flex items-center text-green-600">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="font-medium">
                  {grant.funding_amount_min && grant.funding_amount_max
                    ? `${formatCurrency(grant.funding_amount_min)} - ${formatCurrency(grant.funding_amount_max)}`
                    : formatCurrency(grant.funding_amount_max || grant.funding_amount_min || 0)
                  }
                </span>
              </div>
            )}
            
            {grant.deadline && (
              <div className="flex items-center text-orange-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span className="text-sm">
                  Due: {new Date(grant.deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleViewGrant(grant)}>
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </Button>
            
            {grant.is_bookmarked ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onRemoveBookmark?.(grant.id)}
                className="text-green-600 border-green-200"
              >
                <BookmarkCheck className="h-4 w-4 mr-1" />
                Saved to Pipeline
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onBookmark?.(grant.id)}
              >
                <Bookmark className="h-4 w-4 mr-1" />
                Save to Pipeline
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};