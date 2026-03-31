export interface InsuredInfo {
  id: string;
  companyName: string | null;
  contactName: string | null;
  mailingAddress: string | null;
  dotNumber: string | null;
  mcNumber: string | null;
  yearsInBusiness: number | null;
  state: string | null;
}

export interface BrokerInfo {
  id: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

export interface LineOfBusiness {
  id: string;
  type: string;
}

export interface LimitRequested {
  id: string;
  lineOfBusiness: string | null;
  limitAmount: string | null;
  deductible: string | null;
  description: string | null;
}

export interface TargetPricing {
  id: string;
  lineOfBusiness: string | null;
  targetPremium: string | null;
  currentPremium: string | null;
  description: string | null;
}

export interface ExposureInfo {
  id: string;
  numberOfTrucks: number | null;
  numberOfDrivers: number | null;
  numberOfTrailers: number | null;
  radius: string | null;
  commodities: string[];
  annualRevenue: string | null;
  annualMileage: string | null;
  operatingStates: string[];
  vehicleTypes: string[];
}

export interface LossRecord {
  id: string;
  policyYear: string | null;
  numberOfClaims: number | null;
  totalIncurred: string | null;
  totalPaid: string | null;
  description: string | null;
}

export interface Submission {
  id: string;
  sourceFile: string;
  emailFrom: string | null;
  emailTo: string | null;
  emailSubject: string | null;
  emailDate: string | null;
  rawBody: string | null;
  createdAt: string;
  updatedAt: string;
  insured: InsuredInfo | null;
  broker: BrokerInfo | null;
  linesOfBusiness: LineOfBusiness[];
  limits: LimitRequested[];
  targetPricing: TargetPricing[];
  exposures: ExposureInfo | null;
  losses: LossRecord[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SummaryData {
  totalSubmissions: number;
  linesOfBusiness: { type: string; count: number }[];
  brokers: { companyName: string }[];
}

export interface ExposureWithSubmission extends ExposureInfo {
  submission: {
    emailSubject: string | null;
    insured: { companyName: string | null } | null;
  };
}

export interface LossWithSubmission extends LossRecord {
  submission: {
    emailSubject: string | null;
    insured: { companyName: string | null } | null;
  };
}

export interface IngestResult {
  file: string;
  status: "success" | "error" | "skipped";
  submissionId?: string;
  error?: string;
}

export interface IngestResponse {
  message: string;
  mode: string;
  data: {
    processed: number;
    failed: number;
    results: IngestResult[];
  };
}
