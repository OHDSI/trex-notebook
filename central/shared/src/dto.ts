export type SiteStatus = 'active' | 'disabled' | 'pending';

export interface Site {
  siteId: string;
  name: string;
  contact: string;
  status: SiteStatus;
  cognitoClientId: string;
  createdAt: string;
  createdBy: string;
}

/** Returned only once, at create/rotate — never persisted by us. */
export interface SiteWithSecret extends Site {
  clientSecret: string;
}

export interface SignupRequest { name: string; contact: string; }
export interface SignupAccepted { siteId: string; claimToken: string; }
export interface SignupStatusResponse { status: SiteStatus; }
export interface SignupCredentials {
  status: 'active';
  cognitoClientId: string;
  clientSecret: string;
}

export type StudyStatus = 'draft' | 'published' | 'archived';

export interface Study {
  studyId: string;
  name: string;
  description: string;
  version: string;
  status: StudyStatus;
  strategusKey: string;
  renvLockKey: string;
  createdAt: string;
  publishedAt?: string;
}

export interface PresignedUpload {
  filename: string;
  url: string;
  s3Key: string;
}

/** Draft study plus presigned PUT URLs for its two artifacts. */
export interface StudyWithUploads {
  study: Study;
  uploads: { strategus: PresignedUpload; renvLock: PresignedUpload };
}

export interface StudyPackage {
  studyId: string;
  strategusUrl: string;
  renvLockUrl: string;
}

export type SubmissionStatus = 'pending' | 'complete' | 'failed';

export interface SubmissionFile {
  filename: string;
  s3Key: string;
  sizeBytes: number;
  etag: string;
}

export interface Submission {
  studyId: string;
  siteId: string;
  version: number;
  status: SubmissionStatus;
  files: SubmissionFile[];
  submittedAt: string;
  submittedBy: string;
}

/** Submission plus presigned PUT URLs (initiate) or GET URLs (read). */
export interface SubmissionWithUrls extends Submission {
  urls: { filename: string; url: string }[];
}

// ---- request bodies ----
export interface CreateSiteBody { name: string; contact: string; }
export interface UpdateSiteBody { name?: string; status?: SiteStatus; }
export interface CreateOperatorBody { email: string; }
export interface CreateStudyBody { name: string; description: string; version: string; }
export interface UpdateStudyBody { name?: string; description?: string; version?: string; }
export interface InitiateSubmissionBody { files: { filename: string }[]; }
