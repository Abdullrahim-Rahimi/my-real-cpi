// Community contribution domain types. Mirrors supabase/migrations/0008.

export type CommunityRole = "contributor" | "reviewer" | "approver" | "moderator";
export type CommunityStatus = "pending" | "active" | "suspended";

export type CountryContributorRow = {
  user_id: string;
  country_code: string;
  role: CommunityRole;
  status: CommunityStatus;
  application_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  created_at: string;
};

export type SourceWhitelistRow = {
  country_code: string;
  domain: string;
  description: string | null;
  added_by: string | null;
  added_at: string;
};

export type CpiSubmissionStatus =
  | "pending_review"
  | "pending_approval"
  | "live"
  | "rejected"
  | "superseded";

export type CpiSubmissionRow = {
  id: string;
  country_code: string;
  category_code: string;
  period: string; // ISO date
  index_value: number;
  source_url: string;

  submitted_by: string;
  submitter_country: string;
  submitted_at: string;

  reviewer_id: string | null;
  reviewer_country: string | null;
  reviewed_at: string | null;
  review_action: "approve" | "reject" | null;
  reviewer_note: string | null;

  approver_id: string | null;
  approver_country: string | null;
  approved_at: string | null;
  approve_action: "approve" | "reject" | null;
  approver_note: string | null;

  status: CpiSubmissionStatus;
  superseded_by: string | null;

  created_at: string;
  updated_at: string;
};

// One COICOP category's input in a submission batch.
export type SubmissionEntry = {
  category_code: string; // '00'..'12'
  index_value: number;
};
