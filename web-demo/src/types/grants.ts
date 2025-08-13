export interface SearchRequest {
  keyword: string | null;
  cfda: string | null;
  agencies: string | null;
  sortBy: string;
  rows: number;
  eligibilities: string | null;
  fundingCategories: string | null;
  fundingInstruments: string | null;
  dateRange: string;
  oppStatuses: string;
}

export interface Grant {
  id: string;
  number: string;
  title: string;
  agency: string;
  agencyCode: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
  cfdaList?: string[];
  awardCeiling?: string;
  awardFloor?: string;
}

export interface StatisticOption {
  label: string;
  value: string;
  count: number;
}

export interface AgencyOption extends StatisticOption {
  subAgencyOptions?: StatisticOption[];
  subAgencyOptionCount?: number;
}

export interface SearchResponse {
  hitCount: number;
  startRecord: number;
  oppHits: Grant[];
  oppStatusOptions: StatisticOption[];
  dateRangeOptions: StatisticOption[];
  eligibilities: StatisticOption[];
  fundingCategories: StatisticOption[];
  fundingInstruments: StatisticOption[];
  agencies: AgencyOption[];
  suggestion?: string;
  errorMsgs?: string[];
}

export interface ApplicantType {
  id: string;
  description: string;
}

export interface FundingInstrument {
  id: string;
  description: string;
}

export interface FundingActivityCategory {
  id: string;
  description: string;
}

export interface CFDA {
  id: number;
  opportunityId: number;
  cfdaNumber: string;
  programTitle: string;
}

export interface AgencyDetails {
  code: string;
  seed: string;
  agencyName: string;
  agencyCode: string;
  topAgencyCode: string;
}

export interface SynopsisAttachment {
  id: number;
  opportunityId: number;
  mimeType: string;
  fileName: string;
  fileDescription: string;
  fileLobSize: number;
  createdDate: string;
  synopsisAttFolderId: number;
}

export interface SynopsisAttachmentFolder {
  id: number;
  opportunityId: number;
  folderType: string;
  folderName: string;
  zipLobSize: number;
  createdDate: string;
  lastUpdatedDate: string;
  synopsisAttachments: SynopsisAttachment[];
}

export interface Synopsis {
  opportunityId: number;
  version: number;
  agencyCode: string;
  agencyName: string;
  agencyPhone: string;
  agencyAddressDesc: string;
  agencyDetails: AgencyDetails;
  topAgencyDetails: AgencyDetails;
  agencyContactPhone: string;
  agencyContactName: string;
  agencyContactDesc: string;
  agencyContactEmail: string;
  agencyContactEmailDesc: string;
  synopsisDesc: string;
  responseDate: string;
  responseDateDesc: string;
  fundingDescLinkUrl: string;
  fundingDescLinkDesc: string;
  postingDate: string;
  archiveDate: string;
  fundingActivityCategoryDesc: string;
  costSharing: boolean;
  numberOfAwards: string;
  estimatedFunding: string;
  estimatedFundingFormatted: string;
  awardCeiling: string;
  awardCeilingFormatted: string;
  awardFloor: string;
  awardFloorFormatted: string;
  applicantEligibilityDesc: string;
  applicantTypes: ApplicantType[];
  fundingInstruments: FundingInstrument[];
  fundingActivityCategories: FundingActivityCategory[];
  responseDateStr: string;
  postingDateStr: string;
  archiveDateStr: string;
  createTimeStampStr: string;
  createdDate: string;
  lastUpdatedDate: string;
}

export interface RelatedOpp {
  sourceOpportunityId: number;
  opportunityId: number;
  opportunityNum: string;
  opportunityTitle: string;
  agencyCode: string;
  postedDate: string;
  closeDate: string;
  comments: string;
}

export interface GrantDetail {
  id: number;
  revision: number;
  opportunityNumber: string;
  opportunityTitle: string;
  owningAgencyCode: string;
  listed: string;
  publisherUid: string;
  modifiedComments: string;
  flag2006: string;
  opportunityCategory: {
    category: string;
    description: string;
  };
  synopsis: Synopsis;
  agencyDetails: AgencyDetails;
  topAgencyDetails: AgencyDetails;
  synopsisAttachmentFolders: SynopsisAttachmentFolder[];
  synopsisDocumentURLs: any[];
  synAttChangeComments: any[];
  cfdas: CFDA[];
  opportunityHistoryDetails: any[];
  opportunityPkgs: any[];
  closedOpportunityPkgs: any[];
  originalDueDate: string;
  originalDueDateDesc: string;
  synopsisModifiedFields: any[];
  forecastModifiedFields: any[];
  errorMessages: any[];
  synPostDateInPast: boolean;
  docType: string;
  forecastHistCount: number;
  synopsisHistCount: number;
  assistCompatible: boolean;
  assistURL: string;
  relatedOpps: RelatedOpp[];
  draftMode: string;
}

export interface DetailResponse {
  data?: GrantDetail;
  errorcode?: number;
  msg?: string;
}

export interface KNNDoc {
  opp_num: string;
  opp_id: string;
}

export interface KNNResponse {
  responseHeader: {
    zkConnected: boolean;
    status: number;
    QTime: number;
    params: any;
  };
  response: {
    numFound: number;
    start: number;
    numFoundExact: boolean;
    docs: KNNDoc[];
  };
}