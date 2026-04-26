// lib/mock-data.ts

export type NotificationType =
  | "credential_received"
  | "credential_pending"
  | "credential_expiring"
  | "verification_valid"
  | "verification_invalid"
  | "request_accepted"
  | "request_rejected"
  | "zkp_sent"
  | "presentation_received";

export interface Notification {
  id: string;
  type: NotificationType;
  text: string;
  timeAgo: string;
  read: boolean;
}

export type CredentialStatus = "active" | "pending" | "expiring" | "revoked" | "expired";

export interface Credential {
  id: string;
  type: string;
  issuer: string;
  issuerSeed: string;
  expiresAt: string | null;
  status: CredentialStatus;
  cid: string | null;
}

export type ActivityEventType =
  | "credential_received"
  | "zkp_sent"
  | "verification_valid"
  | "request_submitted"
  | "request_rejected"
  | "wallet_connected"
  | "credential_expiring"
  | "presentation_sent";

export interface ActivityEvent {
  type: ActivityEventType;
  description: string;
  timestamp: string;
}

export interface DashboardStats {
  activeCredentials: number;
  pendingRequests: number;
  presentationsSent: number;
  presentationsVerified: number;
  zkpGenerated: number;
  zkpFailed: number;
}

export const mockNotifications: Notification[] = [
  {
    id: "n-001",
    type: "credential_received",
    text: "Your Master's Diploma VC from Paris-Saclay is ready.",
    timeAgo: "2h ago",
    read: false,
  },
  {
    id: "n-002",
    type: "verification_valid",
    text: "ABC Corp verified your diploma — result: VALID.",
    timeAgo: "Yesterday",
    read: false,
  },
  {
    id: "n-003",
    type: "credential_expiring",
    text: "Your CNSS Social Card expires in 45 days.",
    timeAgo: "3 days ago",
    read: true,
  },
  {
    id: "n-004",
    type: "request_accepted",
    text: "Gouvernement accepted your ID Card request.",
    timeAgo: "5 days ago",
    read: true,
  },
];

export const mockHolder = {
  did: "did:zksync:0x4a9c3f2b1e8d7a06c5f4e3b2a1908d7c6f5e4b3a",
  name: "Asma Mestaysser",
  stats: {
    activeCredentials: 2,
    pendingRequests: 2,
    presentationsSent: 7,
    presentationsVerified: 3,
    zkpGenerated: 3,
    zkpFailed: 0,
  } as DashboardStats,
  credentials: [
    {
      id: "vc-001",
      type: "Master's Diploma",
      issuer: "Université Paris-Saclay",
      issuerSeed: "Paris-Saclay",
      expiresAt: "2034-06-15",
      status: "active" as const,
      cid: "QmX9f3...k2mN8p",
    },
    {
      id: "vc-002",
      type: "National ID Card",
      issuer: "Gouvernement Français",
      issuerSeed: "Gouvernement",
      expiresAt: "2029-01-10",
      status: "active" as const,
      cid: "QmY7a1...p9nQ4r",
    },
    {
      id: "vc-003",
      type: "Employment Certificate",
      issuer: "ABC Corp",
      issuerSeed: "ABC-Corp",
      expiresAt: null,
      status: "pending" as const,
      cid: null,
    },
    {
      id: "vc-004",
      type: "CNSS Social Card",
      issuer: "Sécurité Sociale",
      issuerSeed: "CNSS",
      expiresAt: "2026-03-20",
      status: "expiring" as const,
      cid: "QmZ2b8...w1kL7s",
    },
  ] as Credential[],
  activity: [
    { type: "credential_received" as const, description: "Diploma VC received from Paris-Saclay", timestamp: "2h ago" },
    { type: "zkp_sent" as const, description: "ZKP proof sent to ABC Corp", timestamp: "Yesterday" },
    { type: "verification_valid" as const, description: "Presentation verified · VALID", timestamp: "3 days ago" },
    { type: "request_submitted" as const, description: "Request submitted to Gouvernement", timestamp: "5 days ago" },
    { type: "wallet_connected" as const, description: "Wallet connected · ZKsync Atlas", timestamp: "1 week ago" },
  ] as ActivityEvent[],
};

export const mockIssuer = {
  did: "did:zksync:0x8b2d1e4f7a3c6b9d0e5f2a8c1b4d7e6f3a9c2b5d",
  name: "Paris-Saclay University",
  stats: {
    issued: 147,
    pending: 12,
    revoked: 3,
    keys: 2,
  },
  credentials: [
    {
      id: "vc-i-001",
      type: "Master's Diploma",
      issuer: "Self",
      issuerSeed: "Paris-Saclay",
      expiresAt: "2034-06-15",
      status: "active" as const,
      cid: "QmX9f3...k2mN8p",
    },
    {
      id: "vc-i-002",
      type: "Bachelor's Degree",
      issuer: "Self",
      issuerSeed: "Paris-Saclay",
      expiresAt: "2033-09-01",
      status: "active" as const,
      cid: "QmA2c7...n4pR9s",
    },
    {
      id: "vc-i-003",
      type: "Student ID",
      issuer: "Self",
      issuerSeed: "Paris-Saclay",
      expiresAt: null,
      status: "pending" as const,
      cid: null,
    },
  ] as Credential[],
  activity: [
    { type: "credential_received" as const, description: "Diploma issued to Asma M.", timestamp: "2h ago" },
    { type: "request_submitted" as const, description: "New request from student #4521", timestamp: "5h ago" },
    { type: "credential_received" as const, description: "Bachelor's degree issued to Jean D.", timestamp: "1 day ago" },
    { type: "request_submitted" as const, description: "Revocation request for cert #112", timestamp: "3 days ago" },
    { type: "wallet_connected" as const, description: "Admin wallet reconnected", timestamp: "1 week ago" },
  ] as ActivityEvent[],
};

export const mockVerifier = {
  did: "did:zksync:0x1c4e2d8f6a3b7c9e0d5f1a2b8c4d6e7f3a9b2c5e",
  name: "ABC Corp HR",
  stats: {
    total: 89,
    valid: 82,
    invalid: 4,
    pending: 3,
  },
  credentials: [
    {
      id: "vc-v-001",
      type: "Master's Diploma",
      issuer: "Université Paris-Saclay",
      issuerSeed: "Paris-Saclay",
      expiresAt: "2034-06-15",
      status: "active" as const,
      cid: "QmX9f3...k2mN8p",
    },
    {
      id: "vc-v-002",
      type: "National ID Card",
      issuer: "Gouvernement Français",
      issuerSeed: "Gouvernement",
      expiresAt: "2029-01-10",
      status: "active" as const,
      cid: "QmY7a1...p9nQ4r",
    },
  ] as Credential[],
  activity: [
    { type: "verification_valid" as const, description: "Diploma verified — VALID", timestamp: "1h ago" },
    { type: "presentation_sent" as const, description: "Presentation received from Asma M.", timestamp: "2h ago" },
    { type: "verification_valid" as const, description: "ID Card verified — VALID", timestamp: "1 day ago" },
    { type: "request_rejected" as const, description: "Verification failed — INVALID signature", timestamp: "3 days ago" },
    { type: "wallet_connected" as const, description: "Verifier node synced", timestamp: "1 week ago" },
  ] as ActivityEvent[],
};
