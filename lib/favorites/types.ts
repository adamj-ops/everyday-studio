export interface SavedReferenceRow {
  id: string;
  user_id: string;
  storage_path: string;
  original_filename: string | null;
  category: string;
  space_type: string | null;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
