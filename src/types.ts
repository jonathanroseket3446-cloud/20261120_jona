export interface TargetStatus {
  name: string;
  status: 'Completed' | 'Predicting' | 'Preprocessing' | 'Pending Fold' | 'Pending MSA' | 'Failed/Stopped' | 'Running' | 'Unknown';
}

export interface JobBatch {
  id: string;
  createdAt: string;
  targets: TargetStatus[];
}
