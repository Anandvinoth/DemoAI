export interface OpportunityMetadata {
  stage: string[];
  status: string[];
  currency: string[];
  forecast_category: string[];
  lead_source: string[];
  priority: string[];
  deal_type: string[];
  pipeline_id: string[];
  record_type: string[];
}

export interface OpportunityCreateRequest {
  opportunity_name: string;
  account_id: string;
  primary_contact_id: string;
  owner_id: string;
  stage: string;
  status: string;
  is_closed: boolean;
  is_won: boolean;
  expected_close_date: string | null;  // ISO date
  close_date: string | null;           // ISO date
  amount: number | null;
  currency: string;
  probability: number | null;
  forecast_category: string;
  expected_revenue: number | null;
  lead_source: string;
  campaign_id: string;
  priority: string;
  next_step: string;
  deal_type: string;
  pipeline_id: string;
  description: string;
  pain_points: string;
  customer_needs: string;
  value_proposition: string;
  win_reason: string;
  loss_reason: string;
  record_type: string;
  tags: string;
  last_activity_date: string | null;
  last_contacted_date: string | null;
  next_activity_date: string | null;
  engagement_score: number | null;
}
