export type Role = "ADMIN" | "SIGNER" | "VIEWER" | "PUBLIC_VERIFIER";

export type ActionType = "UPLOAD" | "VIEW" | "SIGN" | "PERMISSION_UPDATE";

export interface Organization {
  id: string;
  name: string;
  createdAt: string | Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  createdAt: string | Date;
}

export interface DocumentMetadata {
  description?: string;
  author?: string;
  department?: string;
  tags?: string[];
  classification?: "Confidential" | "Restricted" | "Public" | "Internal";
  customFields?: Record<string, any>;
}

export interface MerkleBlockData {
  id: string;
  documentId: string;
  blockIndex: number;
  blockHash: string;
  parentHash?: string | null;
  chunkSize: number;
  chunkOffset: number;
}

export interface MerkleProofStep {
  position: "left" | "right";
  hash: string;
}

export interface MerkleTreeResult {
  root: string;
  leaves: string[];
  levels: string[][];
  blocks: {
    blockIndex: number;
    blockHash: string;
    parentHash: string | null;
    chunkSize: number;
    chunkOffset: number;
  }[];
}
export interface AuditLogEntryData {
  id: string;
  documentId: string;
  seq: number;
  actionType: ActionType;
  actorId?: string | null;
  actorEmail?: string | null;
  timestamp: string | Date;
  payloadData: Record<string, any>;
  previousHash: string;
  currentHash: string;
}
export interface DocumentRecord {
  id: string;
  organizationId: string;
  title: string;
  fileHash: string;
  merkleRoot: string;
  fileSize: number;
  mimeType: string;
  metadata: DocumentMetadata;
  createdAt: string | Date;
  updatedAt: string | Date;
  merkleBlocks?: MerkleBlockData[];
  auditLogEntries?: AuditLogEntryData[];
}

export interface VerificationAttemptData {
  id: string;
  documentId?: string | null;
  isAuthentic: boolean;
  fileHash: string;
  merkleRoot: string;
  verifiedAt: string | Date;
  ipAddressHash?: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  organizationId: string;
  type: "access" | "refresh";
}
