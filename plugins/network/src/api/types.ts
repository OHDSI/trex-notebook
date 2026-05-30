export type StudyStatus = 'draft' | 'published' | 'archived';

export interface Study {
  studyId: string;
  name: string;
  description: string;
  version: string;
  status: StudyStatus;
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

export interface SubmissionWithUrls extends Submission {
  urls: { filename: string; url: string }[];
}

export const submissionId = (s: Pick<Submission, 'studyId' | 'siteId' | 'version'>) =>
  `${s.studyId}__${s.siteId}__${s.version}`;
