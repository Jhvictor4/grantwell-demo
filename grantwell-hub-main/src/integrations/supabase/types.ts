export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          ai_response: string | null
          created_at: string
          grant_id: string | null
          id: string
          input_data: Json
          prompt_type: string
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          grant_id?: string | null
          id?: string
          input_data?: Json
          prompt_type: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          grant_id?: string | null
          id?: string
          input_data?: Json
          prompt_type?: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_templates: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          grant_type: string
          id: string
          is_public: boolean | null
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grant_type: string
          id?: string
          is_public?: boolean | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grant_type?: string
          id?: string
          is_public?: boolean | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      application_tracking: {
        Row: {
          agency: string
          amount_max: number | null
          amount_min: number | null
          created_at: string | null
          due_date: string | null
          grant_id: string
          id: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency: string
          amount_max?: number | null
          amount_min?: number | null
          created_at?: string | null
          due_date?: string | null
          grant_id: string
          id?: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency?: string
          amount_max?: number | null
          amount_min?: number | null
          created_at?: string | null
          due_date?: string | null
          grant_id?: string
          id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          description: string | null
          grant_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          description?: string | null
          grant_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          description?: string | null
          grant_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_triggered: string | null
          name: string
          trigger_conditions: Json
          trigger_type: Database["public"]["Enums"]["trigger_type"]
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered?: string | null
          name: string
          trigger_conditions?: Json
          trigger_type: Database["public"]["Enums"]["trigger_type"]
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered?: string | null
          name?: string
          trigger_conditions?: Json
          trigger_type?: Database["public"]["Enums"]["trigger_type"]
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarked_grants: {
        Row: {
          application_stage: string | null
          assigned_to: string | null
          created_at: string
          discovered_grant_id: string
          grant_id: string | null
          id: string
          internal_deadline: string | null
          last_activity_at: string | null
          notes: string | null
          organization_id: string | null
          progress_notes: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_stage?: string | null
          assigned_to?: string | null
          created_at?: string
          discovered_grant_id: string
          grant_id?: string | null
          id?: string
          internal_deadline?: string | null
          last_activity_at?: string | null
          notes?: string | null
          organization_id?: string | null
          progress_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_stage?: string | null
          assigned_to?: string | null
          created_at?: string
          discovered_grant_id?: string
          grant_id?: string | null
          id?: string
          internal_deadline?: string | null
          last_activity_at?: string | null
          notes?: string | null
          organization_id?: string | null
          progress_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarked_grants_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarked_grants_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarked_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bookmarked_grants_discovered"
            columns: ["discovered_grant_id"]
            isOneToOne: false
            referencedRelation: "discovered_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_line_items: {
        Row: {
          allocated_amount: number
          budgeted_amount: number
          category: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          fiscal_year: number
          grant_id: string | null
          id: string
          item_name: string
          quarter: number | null
          spent_amount: number
          tags: string | null
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          budgeted_amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year: number
          grant_id?: string | null
          id?: string
          item_name: string
          quarter?: number | null
          spent_amount?: number
          tags?: string | null
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          budgeted_amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year?: number
          grant_id?: string | null
          id?: string
          item_name?: string
          quarter?: number | null
          spent_amount?: number
          tags?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_line_items_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_line_items_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_summaries: {
        Row: {
          created_at: string | null
          grant_id: string | null
          id: string
          last_updated: string | null
          quarterly_usage: Json | null
          remaining_funds: number | null
          total_awarded: number | null
          total_spent: number | null
        }
        Insert: {
          created_at?: string | null
          grant_id?: string | null
          id?: string
          last_updated?: string | null
          quarterly_usage?: Json | null
          remaining_funds?: number | null
          total_awarded?: number | null
          total_spent?: number | null
        }
        Update: {
          created_at?: string | null
          grant_id?: string | null
          id?: string
          last_updated?: string | null
          quarterly_usage?: Json | null
          remaining_funds?: number | null
          total_awarded?: number | null
          total_spent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_summaries_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: true
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_summaries_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: true
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_custom_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string | null
          grant_id: string | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string | null
          grant_id?: string | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          grant_id?: string | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_custom_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_custom_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          calendar_integration_id: string | null
          created_at: string
          end_time: string
          event_description: string | null
          event_title: string
          grant_id: string | null
          id: string
          is_all_day: boolean
          last_synced_at: string
          provider_event_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          calendar_integration_id?: string | null
          created_at?: string
          end_time: string
          event_description?: string | null
          event_title: string
          grant_id?: string | null
          id?: string
          is_all_day?: boolean
          last_synced_at?: string
          provider_event_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          calendar_integration_id?: string | null
          created_at?: string
          end_time?: string
          event_description?: string | null
          event_title?: string
          grant_id?: string | null
          id?: string
          is_all_day?: boolean
          last_synced_at?: string
          provider_event_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_integration_id_fkey"
            columns: ["calendar_integration_id"]
            isOneToOne: false
            referencedRelation: "calendar_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_integrations: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          calendar_name: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          provider: string
          provider_account_id: string
          refresh_token: string | null
          sync_enabled: boolean
          token_expires_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          calendar_name?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          provider: string
          provider_account_id: string
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          calendar_name?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          provider?: string
          provider_account_id?: string
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_settings: {
        Row: {
          created_at: string
          email_reminders: boolean | null
          google_calendar_enabled: boolean | null
          id: string
          last_sync: string | null
          outlook_calendar_enabled: boolean | null
          reminder_days_before: number | null
          sync_deadlines: boolean | null
          sync_milestones: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_reminders?: boolean | null
          google_calendar_enabled?: boolean | null
          id?: string
          last_sync?: string | null
          outlook_calendar_enabled?: boolean | null
          reminder_days_before?: number | null
          sync_deadlines?: boolean | null
          sync_milestones?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_reminders?: boolean | null
          google_calendar_enabled?: boolean | null
          id?: string
          last_sync?: string | null
          outlook_calendar_enabled?: boolean | null
          reminder_days_before?: number | null
          sync_deadlines?: boolean | null
          sync_milestones?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      closeout_items: {
        Row: {
          due_on: string | null
          evidence_file_id: string | null
          grant_id: string
          id: string
          label: string
          required: boolean | null
          status: string | null
        }
        Insert: {
          due_on?: string | null
          evidence_file_id?: string | null
          grant_id: string
          id?: string
          label: string
          required?: boolean | null
          status?: string | null
        }
        Update: {
          due_on?: string | null
          evidence_file_id?: string | null
          grant_id?: string
          id?: string
          label?: string
          required?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closeout_items_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closeout_items_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      closeout_logs: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          file_url: string | null
          grant_id: string
          id: string
          log_type: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          grant_id: string
          id?: string
          log_type: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          grant_id?: string
          id?: string
          log_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      closeout_status: {
        Row: {
          closeout_complete: boolean
          completed_at: string | null
          created_at: string
          equipment_disposition_completed: boolean
          equipment_disposition_file_url: string | null
          final_narrative_completed: boolean
          final_narrative_file_url: string | null
          final_sf425_completed: boolean
          final_sf425_file_url: string | null
          grant_id: string
          id: string
          unspent_funds_completed: boolean
          unspent_funds_file_url: string | null
          updated_at: string
        }
        Insert: {
          closeout_complete?: boolean
          completed_at?: string | null
          created_at?: string
          equipment_disposition_completed?: boolean
          equipment_disposition_file_url?: string | null
          final_narrative_completed?: boolean
          final_narrative_file_url?: string | null
          final_sf425_completed?: boolean
          final_sf425_file_url?: string | null
          grant_id: string
          id?: string
          unspent_funds_completed?: boolean
          unspent_funds_file_url?: string | null
          updated_at?: string
        }
        Update: {
          closeout_complete?: boolean
          completed_at?: string | null
          created_at?: string
          equipment_disposition_completed?: boolean
          equipment_disposition_file_url?: string | null
          final_narrative_completed?: boolean
          final_narrative_file_url?: string | null
          final_sf425_completed?: boolean
          final_sf425_file_url?: string | null
          grant_id?: string
          id?: string
          unspent_funds_completed?: boolean
          unspent_funds_file_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      compliance_checklist: {
        Row: {
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          grant_id: string
          id: string
          is_complete: boolean
          is_custom: boolean | null
          item_name: string
          order_index: number | null
          updated_at: string
        }
        Insert: {
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          grant_id: string
          id?: string
          is_complete?: boolean
          is_custom?: boolean | null
          item_name: string
          order_index?: number | null
          updated_at?: string
        }
        Update: {
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          grant_id?: string
          id?: string
          is_complete?: boolean
          is_custom?: boolean | null
          item_name?: string
          order_index?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      compliance_events: {
        Row: {
          created_at: string | null
          due_on: string
          grant_id: string
          id: string
          notes: string | null
          status: string | null
          submitted_on: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          due_on: string
          grant_id: string
          id?: string
          notes?: string | null
          status?: string | null
          submitted_on?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          due_on?: string
          grant_id?: string
          id?: string
          notes?: string | null
          status?: string | null
          submitted_on?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_files: {
        Row: {
          audit_trail: Json | null
          compliance_section: string
          created_at: string | null
          file_id: string | null
          file_name: string
          file_path: string
          grant_id: string
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
          version_number: number | null
        }
        Insert: {
          audit_trail?: Json | null
          compliance_section: string
          created_at?: string | null
          file_id?: string | null
          file_name: string
          file_path: string
          grant_id: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          version_number?: number | null
        }
        Update: {
          audit_trail?: Json | null
          compliance_section?: string
          created_at?: string | null
          file_id?: string | null
          file_name?: string
          file_path?: string
          grant_id?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_files_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_files_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_logs: {
        Row: {
          activity_description: string
          attachment_url: string | null
          created_at: string
          created_by: string | null
          grant_id: string | null
          id: string
          log_type: string
          notes: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          activity_description: string
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          grant_id?: string | null
          id?: string
          log_type?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          activity_description?: string
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          grant_id?: string | null
          id?: string
          log_type?: string
          notes?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_logs_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_logs_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      contextual_documents: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          folder_id: string | null
          grant_id: string | null
          id: string
          is_active: boolean
          linked_entity_id: string | null
          linked_feature: string
          mime_type: string
          original_name: string
          tags: string[] | null
          updated_at: string
          upload_date: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          folder_id?: string | null
          grant_id?: string | null
          id?: string
          is_active?: boolean
          linked_entity_id?: string | null
          linked_feature: string
          mime_type: string
          original_name: string
          tags?: string[] | null
          updated_at?: string
          upload_date?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          folder_id?: string | null
          grant_id?: string | null
          id?: string
          is_active?: boolean
          linked_entity_id?: string | null
          linked_feature?: string
          mime_type?: string
          original_name?: string
          tags?: string[] | null
          updated_at?: string
          upload_date?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contextual_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      data_lifecycle_events: {
        Row: {
          entity_id: string
          entity_type: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          performed_at: string | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          entity_id: string
          entity_type: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          performed_at?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          entity_id?: string
          entity_type?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          performed_at?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          completed: boolean | null
          created_at: string
          due_date: string
          grant_id: string
          id: string
          name: string
          reminder_days_before: number | null
          type: Database["public"]["Enums"]["deadline_type"]
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          due_date: string
          grant_id: string
          id?: string
          name: string
          reminder_days_before?: number | null
          type: Database["public"]["Enums"]["deadline_type"]
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          due_date?: string
          grant_id?: string
          id?: string
          name?: string
          reminder_days_before?: number | null
          type?: Database["public"]["Enums"]["deadline_type"]
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      department_ip_whitelist: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_name: string
          id: string
          ip_address: unknown
          ip_range: unknown | null
          is_active: boolean | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department_name: string
          id?: string
          ip_address: unknown
          ip_range?: unknown | null
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department_name?: string
          id?: string
          ip_address?: unknown
          ip_range?: unknown | null
          is_active?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      discovered_grants: {
        Row: {
          agency: string
          category: string | null
          cfda_numbers: string[] | null
          created_at: string
          deadline: string | null
          eligibility: string | null
          external_url: string | null
          funding_activity: string | null
          funding_amount_max: number | null
          funding_amount_min: number | null
          id: string
          last_updated: string | null
          opp_id: string | null
          opportunity_id: string
          organization_id: string | null
          posted_date: string | null
          raw_data: Json | null
          sector: string | null
          status: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agency: string
          category?: string | null
          cfda_numbers?: string[] | null
          created_at?: string
          deadline?: string | null
          eligibility?: string | null
          external_url?: string | null
          funding_activity?: string | null
          funding_amount_max?: number | null
          funding_amount_min?: number | null
          id?: string
          last_updated?: string | null
          opp_id?: string | null
          opportunity_id: string
          organization_id?: string | null
          posted_date?: string | null
          raw_data?: Json | null
          sector?: string | null
          status?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agency?: string
          category?: string | null
          cfda_numbers?: string[] | null
          created_at?: string
          deadline?: string | null
          eligibility?: string | null
          external_url?: string | null
          funding_activity?: string | null
          funding_amount_max?: number | null
          funding_amount_min?: number | null
          id?: string
          last_updated?: string | null
          opp_id?: string | null
          opportunity_id?: string
          organization_id?: string | null
          posted_date?: string | null
          raw_data?: Json | null
          sector?: string | null
          status?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          chunk_text: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "contextual_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          created_at: string
          created_by: string
          grant_id: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          grant_id: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          grant_id?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_metadata: {
        Row: {
          created_at: string
          description: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          grant_id: string | null
          id: string
          is_current_version: boolean
          mime_type: string
          original_name: string
          parent_document_id: string | null
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          grant_id?: string | null
          id?: string
          is_current_version?: boolean
          mime_type: string
          original_name: string
          parent_document_id?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          version_number?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          grant_id?: string | null
          id?: string
          is_current_version?: boolean
          mime_type?: string
          original_name?: string
          parent_document_id?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_metadata_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_metadata_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_metadata_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "document_metadata"
            referencedColumns: ["id"]
          },
        ]
      }
      document_storage: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_tags: string[] | null
          file_type: string
          grant_id: string | null
          id: string
          requires_signature: boolean | null
          signature_status: string | null
          storage_path: string
          storage_provider: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_tags?: string[] | null
          file_type: string
          grant_id?: string | null
          id?: string
          requires_signature?: boolean | null
          signature_status?: string | null
          storage_path: string
          storage_provider?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_tags?: string[] | null
          file_type?: string
          grant_id?: string | null
          id?: string
          requires_signature?: boolean | null
          signature_status?: string | null
          storage_path?: string
          storage_provider?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_storage_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_storage_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_notes: string | null
          file_name: string
          file_path: string
          file_size: number
          grant_id: string | null
          id: string
          is_current_version: boolean | null
          mime_type: string
          parent_document_id: string
          upload_date: string | null
          uploaded_by: string
          version_number: number
        }
        Insert: {
          change_notes?: string | null
          file_name: string
          file_path: string
          file_size: number
          grant_id?: string | null
          id?: string
          is_current_version?: boolean | null
          mime_type: string
          parent_document_id: string
          upload_date?: string | null
          uploaded_by: string
          version_number?: number
        }
        Update: {
          change_notes?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          grant_id?: string | null
          id?: string
          is_current_version?: boolean | null
          mime_type?: string
          parent_document_id?: string
          upload_date?: string | null
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          description: string | null
          file_name: string
          file_url: string
          grant_id: string
          id: string
          upload_date: string
          uploaded_by: string | null
        }
        Insert: {
          description?: string | null
          file_name: string
          file_url: string
          grant_id: string
          id?: string
          upload_date?: string
          uploaded_by?: string | null
        }
        Update: {
          description?: string | null
          file_name?: string
          file_url?: string
          grant_id?: string
          id?: string
          upload_date?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      drawdowns: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          draw_date: string
          grant_id: string
          id: string
          purpose: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          draw_date: string
          grant_id: string
          id?: string
          purpose?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          draw_date?: string
          grant_id?: string
          id?: string
          purpose?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawdowns_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawdowns_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          api_key_name: string
          created_at: string | null
          id: string
          is_enabled: boolean | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          api_key_name?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          provider?: string
          updated_at?: string | null
        }
        Update: {
          api_key_name?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_costs: {
        Row: {
          category: string
          created_at: string | null
          current_price: number
          description: string | null
          id: string
          item_name: string
          maintenance_cost_annual: number | null
          manufacturer: string | null
          model: string | null
          price_date: string | null
          specifications: Json | null
          subcategory: string | null
          typical_lifespan_years: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          current_price: number
          description?: string | null
          id?: string
          item_name: string
          maintenance_cost_annual?: number | null
          manufacturer?: string | null
          model?: string | null
          price_date?: string | null
          specifications?: Json | null
          subcategory?: string | null
          typical_lifespan_years?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          current_price?: number
          description?: string | null
          id?: string
          item_name?: string
          maintenance_cost_annual?: number | null
          manufacturer?: string | null
          model?: string | null
          price_date?: string | null
          specifications?: Json | null
          subcategory?: string | null
          typical_lifespan_years?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_templates: {
        Row: {
          budget_items: Json | null
          category: string
          created_at: string | null
          id: string
          narrative_sections: Json | null
          template_data: Json
          template_name: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          budget_items?: Json | null
          category: string
          created_at?: string | null
          id?: string
          narrative_sections?: Json | null
          template_data: Json
          template_name: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          budget_items?: Json | null
          category?: string
          created_at?: string | null
          id?: string
          narrative_sections?: Json | null
          template_data?: Json
          template_name?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      erp_export_history: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          export_type: string
          exported_by: string | null
          file_name: string
          file_size: number | null
          format: string
          id: string
          parameters: Json | null
          record_count: number
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          export_type: string
          exported_by?: string | null
          file_name: string
          file_size?: number | null
          format: string
          id?: string
          parameters?: Json | null
          record_count?: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          export_type?: string
          exported_by?: string | null
          file_name?: string
          file_size?: number | null
          format?: string
          id?: string
          parameters?: Json | null
          record_count?: number
          status?: string
        }
        Relationships: []
      }
      erp_integrations: {
        Row: {
          configuration: Json | null
          created_at: string
          id: string
          integration_name: string
          is_enabled: boolean | null
          last_sync: string | null
          updated_at: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          id?: string
          integration_name: string
          is_enabled?: boolean | null
          last_sync?: string | null
          updated_at?: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          id?: string
          integration_name?: string
          is_enabled?: boolean | null
          last_sync?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          budget_line_item_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          grant_id: string
          id: string
          invoice_number: string | null
          receipt_url: string | null
          uploaded_by: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          budget_line_item_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          grant_id: string
          id?: string
          invoice_number?: string | null
          receipt_url?: string | null
          uploaded_by?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          budget_line_item_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          grant_id?: string
          id?: string
          invoice_number?: string | null
          receipt_url?: string | null
          uploaded_by?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_budget_line_item_id_fkey"
            columns: ["budget_line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      file_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          file_id: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          grant_id: string | null
          id: string
          ip_address: unknown | null
          linked_feature: string | null
          mime_type: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          file_id?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          grant_id?: string | null
          id?: string
          ip_address?: unknown | null
          linked_feature?: string | null
          mime_type?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          file_id?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          grant_id?: string | null
          id?: string
          ip_address?: unknown | null
          linked_feature?: string | null
          mime_type?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_audit_logs_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_audit_logs_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      file_mappings: {
        Row: {
          created_at: string | null
          grant_id: string
          id: string
          period_end: string | null
          period_start: string | null
          storage_path: string
          template_type: string
        }
        Insert: {
          created_at?: string | null
          grant_id: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          storage_path: string
          template_type: string
        }
        Update: {
          created_at?: string | null
          grant_id?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          storage_path?: string
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_mappings_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_mappings_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          created_at: string
          end_date: string
          fiscal_year: number
          id: string
          is_current: boolean
          period_name: string
          period_type: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          fiscal_year: number
          id?: string
          is_current?: boolean
          period_name: string
          period_type: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          fiscal_year?: number
          id?: string
          is_current?: boolean
          period_name?: string
          period_type?: string
          start_date?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          completed_at: string | null
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          file_url: string | null
          generated_by: string | null
          grant_ids: string[] | null
          id: string
          parameters: Json
          status: string
          template_id: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          file_url?: string | null
          generated_by?: string | null
          grant_ids?: string[] | null
          id?: string
          parameters?: Json
          status?: string
          template_id?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          file_url?: string | null
          generated_by?: string | null
          grant_ids?: string[] | null
          id?: string
          parameters?: Json
          status?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_activity_log: {
        Row: {
          action: string
          created_at: string
          description: string | null
          grant_id: string
          id: string
          payload: Json | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          grant_id: string
          id?: string
          payload?: Json | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          grant_id?: string
          id?: string
          payload?: Json | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      grant_activity_logs: {
        Row: {
          action_type: string
          created_at: string | null
          description: string
          grant_application_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          performed_at: string | null
          performed_by: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description: string
          grant_application_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_at?: string | null
          performed_by?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string
          grant_application_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_at?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_activity_logs_grant_application_id_fkey"
            columns: ["grant_application_id"]
            isOneToOne: false
            referencedRelation: "bookmarked_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_activity_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_application_documents: {
        Row: {
          created_at: string | null
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number
          grant_application_id: string
          id: string
          is_current_version: boolean | null
          mime_type: string
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          version_number: number | null
        }
        Insert: {
          created_at?: string | null
          document_type?: string | null
          file_name: string
          file_path: string
          file_size: number
          grant_application_id: string
          id?: string
          is_current_version?: boolean | null
          mime_type: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number?: number | null
        }
        Update: {
          created_at?: string | null
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          grant_application_id?: string
          id?: string
          is_current_version?: boolean | null
          mime_type?: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_application_documents_grant_application_id_fkey"
            columns: ["grant_application_id"]
            isOneToOne: false
            referencedRelation: "bookmarked_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_application_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_award_setup: {
        Row: {
          asap_account_id: string | null
          asap_status: string | null
          award_acceptance_date: string | null
          award_accepted: boolean | null
          created_at: string | null
          duns: string | null
          grant_id: string
          id: string
          sam_expiration: string | null
          uei: string | null
          updated_at: string | null
        }
        Insert: {
          asap_account_id?: string | null
          asap_status?: string | null
          award_acceptance_date?: string | null
          award_accepted?: boolean | null
          created_at?: string | null
          duns?: string | null
          grant_id: string
          id?: string
          sam_expiration?: string | null
          uei?: string | null
          updated_at?: string | null
        }
        Update: {
          asap_account_id?: string | null
          asap_status?: string | null
          award_acceptance_date?: string | null
          award_accepted?: boolean | null
          created_at?: string | null
          duns?: string | null
          grant_id?: string
          id?: string
          sam_expiration?: string | null
          uei?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_award_setup_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_award_setup_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_closeout_status: {
        Row: {
          assigned_compliance_officer: string | null
          completion_percentage: number | null
          created_at: string | null
          grant_id: string
          id: string
          internal_deadline: string | null
          is_locked: boolean | null
          overall_status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_compliance_officer?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          grant_id: string
          id?: string
          internal_deadline?: string | null
          is_locked?: boolean | null
          overall_status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_compliance_officer?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          grant_id?: string
          id?: string
          internal_deadline?: string | null
          is_locked?: boolean | null
          overall_status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_closeout_status_assigned_compliance_officer_fkey"
            columns: ["assigned_compliance_officer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_closeout_status_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: true
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_closeout_status_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: true
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_closeout_status_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_closeout_tasks: {
        Row: {
          assigned_user: string | null
          completed_at: string | null
          created_at: string | null
          due_date: string | null
          file_url: string | null
          grant_id: string
          id: string
          notes: string | null
          payload: Json | null
          status: string
          task_name: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          assigned_user?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          file_url?: string | null
          grant_id: string
          id?: string
          notes?: string | null
          payload?: Json | null
          status?: string
          task_name: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          assigned_user?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          file_url?: string | null
          grant_id?: string
          id?: string
          notes?: string | null
          payload?: Json | null
          status?: string
          task_name?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_closeout_tasks_assigned_user_fkey"
            columns: ["assigned_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_closeout_tasks_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_closeout_tasks_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_closeouts: {
        Row: {
          completed: boolean
          created_at: string
          file_url: string | null
          grant_id: string
          id: string
          item: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          file_url?: string | null
          grant_id: string
          id?: string
          item: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          file_url?: string | null
          grant_id?: string
          id?: string
          item?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grant_documents: {
        Row: {
          audit_notes: string | null
          audit_status: string | null
          category: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          grant_id: string | null
          id: string
          is_current_version: boolean | null
          mime_type: string
          original_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          subcategory: string | null
          tags: string[] | null
          uploaded_at: string | null
          uploaded_by: string | null
          version_number: number | null
        }
        Insert: {
          audit_notes?: string | null
          audit_status?: string | null
          category: string
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          grant_id?: string | null
          id?: string
          is_current_version?: boolean | null
          mime_type: string
          original_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          subcategory?: string | null
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number?: number | null
        }
        Update: {
          audit_notes?: string | null
          audit_status?: string | null
          category?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          grant_id?: string | null
          id?: string
          is_current_version?: boolean | null
          mime_type?: string
          original_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          subcategory?: string | null
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_documents_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_documents_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_drawdowns: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          file_url: string | null
          grant_id: string
          id: string
          purpose: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          file_url?: string | null
          grant_id: string
          id?: string
          purpose?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          file_url?: string | null
          grant_id?: string
          id?: string
          purpose?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grant_match_scores: {
        Row: {
          computed_at: string
          discovered_grant_id: string
          id: string
          match_reasons: Json | null
          match_score: number | null
          user_id: string
        }
        Insert: {
          computed_at?: string
          discovered_grant_id: string
          id?: string
          match_reasons?: Json | null
          match_score?: number | null
          user_id: string
        }
        Update: {
          computed_at?: string
          discovered_grant_id?: string
          id?: string
          match_reasons?: Json | null
          match_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_grant_match_scores_discovered"
            columns: ["discovered_grant_id"]
            isOneToOne: false
            referencedRelation: "discovered_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_matches: {
        Row: {
          created_at: string | null
          docs_file_id: string | null
          fulfilled: number | null
          grant_id: string
          id: string
          pledged: number | null
          source: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          docs_file_id?: string | null
          fulfilled?: number | null
          grant_id: string
          id?: string
          pledged?: number | null
          source?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          docs_file_id?: string | null
          fulfilled?: number | null
          grant_id?: string
          id?: string
          pledged?: number | null
          source?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_matches_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_matches_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          grant_id: string
          id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          grant_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          grant_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_notes_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_notes_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_opportunities: {
        Row: {
          agency: string
          category: string | null
          created_at: string
          deadline: string
          description: string | null
          eligibility: string | null
          funding_amount_max: number | null
          funding_amount_min: number | null
          id: string
          is_saved_to_pipeline: boolean | null
          opportunity_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agency: string
          category?: string | null
          created_at?: string
          deadline: string
          description?: string | null
          eligibility?: string | null
          funding_amount_max?: number | null
          funding_amount_min?: number | null
          id?: string
          is_saved_to_pipeline?: boolean | null
          opportunity_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agency?: string
          category?: string | null
          created_at?: string
          deadline?: string
          description?: string | null
          eligibility?: string | null
          funding_amount_max?: number | null
          funding_amount_min?: number | null
          id?: string
          is_saved_to_pipeline?: boolean | null
          opportunity_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      grant_preferences: {
        Row: {
          created_at: string
          department_priorities: string[] | null
          focus_areas: Json | null
          id: string
          keywords: string[] | null
          max_funding_amount: number | null
          min_funding_amount: number | null
          preferred_agencies: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_priorities?: string[] | null
          focus_areas?: Json | null
          id?: string
          keywords?: string[] | null
          max_funding_amount?: number | null
          min_funding_amount?: number | null
          preferred_agencies?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_priorities?: string[] | null
          focus_areas?: Json | null
          id?: string
          keywords?: string[] | null
          max_funding_amount?: number | null
          min_funding_amount?: number | null
          preferred_agencies?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grant_progress: {
        Row: {
          attachments_complete: boolean
          budget_complete: boolean
          closeout_complete: boolean
          compliance_complete: boolean
          created_at: string
          grant_id: string
          id: string
          narrative_complete: boolean
          overview_complete: boolean
          tasks_complete: boolean
          updated_at: string
        }
        Insert: {
          attachments_complete?: boolean
          budget_complete?: boolean
          closeout_complete?: boolean
          compliance_complete?: boolean
          created_at?: string
          grant_id: string
          id?: string
          narrative_complete?: boolean
          overview_complete?: boolean
          tasks_complete?: boolean
          updated_at?: string
        }
        Update: {
          attachments_complete?: boolean
          budget_complete?: boolean
          closeout_complete?: boolean
          compliance_complete?: boolean
          created_at?: string
          grant_id?: string
          id?: string
          narrative_complete?: boolean
          overview_complete?: boolean
          tasks_complete?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_progress_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: true
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_progress_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: true
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_sync_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          grants_found: number | null
          grants_imported: number | null
          id: string
          status: string | null
          sync_duration_ms: number | null
          sync_type: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          grants_found?: number | null
          grants_imported?: number | null
          id?: string
          status?: string | null
          sync_duration_ms?: number | null
          sync_type: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          grants_found?: number | null
          grants_imported?: number | null
          id?: string
          status?: string | null
          sync_duration_ms?: number | null
          sync_type?: string
        }
        Relationships: []
      }
      grant_team: {
        Row: {
          created_at: string
          email: string
          grant_id: string
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          grant_id: string
          id?: string
          name: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          grant_id?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      grant_team_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          email: string | null
          grant_id: string | null
          id: string
          is_active: boolean | null
          last_accessed: string | null
          permissions: string[] | null
          role: string
          user_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          email?: string | null
          grant_id?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed?: string | null
          permissions?: string[] | null
          role: string
          user_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          email?: string | null
          grant_id?: string | null
          id?: string
          is_active?: boolean | null
          last_accessed?: string | null
          permissions?: string[] | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_team_assignments_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_team_assignments_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_users: {
        Row: {
          created_at: string | null
          grant_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          grant_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          grant_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_users_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_users_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      GrantData: {
        Row: {
          Agency: string | null
          Amount: number | null
          EndDate: string | null
          GrantName: string | null
          GrantNumber: string | null
          id: number
          Location: string
          StartDate: string | null
          Type: string | null
        }
        Insert: {
          Agency?: string | null
          Amount?: number | null
          EndDate?: string | null
          GrantName?: string | null
          GrantNumber?: string | null
          id?: number
          Location: string
          StartDate?: string | null
          Type?: string | null
        }
        Update: {
          Agency?: string | null
          Amount?: number | null
          EndDate?: string | null
          GrantName?: string | null
          GrantNumber?: string | null
          id?: number
          Location?: string
          StartDate?: string | null
          Type?: string | null
        }
        Relationships: []
      }
      grants: {
        Row: {
          amount_awarded: number | null
          coordinator_name: string | null
          created_at: string
          discovered_grant_id: string | null
          end_date: string | null
          funder: string
          id: string
          organization_id: string | null
          owner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["grant_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          amount_awarded?: number | null
          coordinator_name?: string | null
          created_at?: string
          discovered_grant_id?: string | null
          end_date?: string | null
          funder: string
          id?: string
          organization_id?: string | null
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["grant_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          amount_awarded?: number | null
          coordinator_name?: string | null
          created_at?: string
          discovered_grant_id?: string | null
          end_date?: string | null
          funder?: string
          id?: string
          organization_id?: string | null
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["grant_status"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_discovered_grant_id_fkey"
            columns: ["discovered_grant_id"]
            isOneToOne: false
            referencedRelation: "discovered_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          assigned_to: string | null
          completion_date: string | null
          created_at: string
          created_by: string | null
          due_date: string
          grant_id: string
          id: string
          milestone_type: string | null
          name: string
          priority: string | null
          progress_percentage: number | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          grant_id: string
          id?: string
          milestone_type?: string | null
          name: string
          priority?: string | null
          progress_percentage?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          grant_id?: string
          id?: string
          milestone_type?: string | null
          name?: string
          priority?: string | null
          progress_percentage?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          compliance_alerts: boolean
          created_at: string
          deadline_reminders: boolean
          email_enabled: boolean
          id: string
          milestone_alerts: boolean
          reminder_days_before: number
          report_reminders: boolean
          task_assignments: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          compliance_alerts?: boolean
          created_at?: string
          deadline_reminders?: boolean
          email_enabled?: boolean
          id?: string
          milestone_alerts?: boolean
          reminder_days_before?: number
          report_reminders?: boolean
          task_assignments?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          compliance_alerts?: boolean
          created_at?: string
          deadline_reminders?: boolean
          email_enabled?: boolean
          id?: string
          milestone_alerts?: boolean
          reminder_days_before?: number
          report_reminders?: boolean
          task_assignments?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          grant_id: string
          id: string
          message: string
          related_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grant_id: string
          id?: string
          message: string
          related_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          grant_id?: string
          id?: string
          message?: string
          related_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string | null
          organization_id: string
          permissions: string[] | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          organization_id: string
          permissions?: string[] | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          organization_id?: string
          permissions?: string[] | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          duns_number: string | null
          id: string
          last_sam_check: string | null
          organization_name: string
          sam_expiration_date: string | null
          sam_status: string | null
          uei_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duns_number?: string | null
          id?: string
          last_sam_check?: string | null
          organization_name: string
          sam_expiration_date?: string | null
          sam_status?: string | null
          uei_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duns_number?: string | null
          id?: string
          last_sam_check?: string | null
          organization_name?: string
          sam_expiration_date?: string | null
          sam_status?: string | null
          uei_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      outcomes: {
        Row: {
          actual_value: string | null
          created_at: string
          evidence_url: string | null
          grant_id: string | null
          id: string
          measurement_date: string | null
          metric_name: string
          milestone_id: string | null
          notes: string | null
          outcome_type: string
          recorded_by: string | null
          target_value: string | null
          updated_at: string
        }
        Insert: {
          actual_value?: string | null
          created_at?: string
          evidence_url?: string | null
          grant_id?: string | null
          id?: string
          measurement_date?: string | null
          metric_name: string
          milestone_id?: string | null
          notes?: string | null
          outcome_type: string
          recorded_by?: string | null
          target_value?: string | null
          updated_at?: string
        }
        Update: {
          actual_value?: string | null
          created_at?: string
          evidence_url?: string | null
          grant_id?: string | null
          id?: string
          measurement_date?: string | null
          metric_name?: string
          milestone_id?: string | null
          notes?: string | null
          outcome_type?: string
          recorded_by?: string | null
          target_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcomes_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcomes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      process_trackers: {
        Row: {
          actual_completion: string | null
          blocking_issues: Json | null
          created_at: string | null
          current_stage: string
          expected_completion: string | null
          grant_id: string
          id: string
          metadata: Json | null
          process_name: string
          progress_percentage: number | null
          started_at: string | null
          status: string | null
          total_stages: number
          updated_at: string | null
        }
        Insert: {
          actual_completion?: string | null
          blocking_issues?: Json | null
          created_at?: string | null
          current_stage: string
          expected_completion?: string | null
          grant_id: string
          id?: string
          metadata?: Json | null
          process_name: string
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          total_stages: number
          updated_at?: string | null
        }
        Update: {
          actual_completion?: string | null
          blocking_issues?: Json | null
          created_at?: string | null
          current_stage?: string
          expected_completion?: string | null
          grant_id?: string
          id?: string
          metadata?: Json | null
          process_name?: string
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          total_stages?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          last_login: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          state: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          invited_at?: string | null
          invited_by?: string | null
          last_login?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          last_login?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quarterly_reports: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string
          grant_id: string
          id: string
          narrative_file_url: string | null
          quarter_year: string
          sf425_file_url: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date: string
          grant_id: string
          id?: string
          narrative_file_url?: string | null
          quarter_year: string
          sf425_file_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string
          grant_id?: string
          id?: string
          narrative_file_url?: string | null
          quarter_year?: string
          sf425_file_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_logs: {
        Row: {
          created_at: string
          due_date: string
          file_url: string | null
          grant_id: string
          id: string
          notes: string | null
          submitted_on: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          file_url?: string | null
          grant_id: string
          id?: string
          notes?: string | null
          submitted_on?: string | null
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          file_url?: string | null
          grant_id?: string
          id?: string
          notes?: string | null
          submitted_on?: string | null
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          filters: Json
          id: string
          is_system: boolean
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          filters?: Json
          id?: string
          is_system?: boolean
          name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          filters?: Json
          id?: string
          is_system?: boolean
          name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_filter_views: {
        Row: {
          created_at: string | null
          filter_data: Json
          id: string
          is_default: boolean | null
          updated_at: string | null
          user_id: string
          view_name: string
        }
        Insert: {
          created_at?: string | null
          filter_data?: Json
          id?: string
          is_default?: boolean | null
          updated_at?: string | null
          user_id: string
          view_name: string
        }
        Update: {
          created_at?: string | null
          filter_data?: Json
          id?: string
          is_default?: boolean | null
          updated_at?: string | null
          user_id?: string
          view_name?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alert_frequency: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          search_criteria: Json
          search_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_frequency?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          search_criteria?: Json
          search_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_frequency?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          search_criteria?: Json
          search_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_export_jobs: {
        Row: {
          created_at: string | null
          created_by: string | null
          export_type: string
          filters: Json | null
          format: string
          frequency: string
          id: string
          is_active: boolean | null
          job_name: string
          last_run: string | null
          next_run: string | null
          schedule_config: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          export_type: string
          filters?: Json | null
          format: string
          frequency: string
          id?: string
          is_active?: boolean | null
          job_name: string
          last_run?: string | null
          next_run?: string | null
          schedule_config?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          export_type?: string
          filters?: Json | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean | null
          job_name?: string
          last_run?: string | null
          next_run?: string | null
          schedule_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          description: string | null
          id: string
          is_active: boolean | null
          setting_name: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_name: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_name?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      state_grant_portals: {
        Row: {
          "Grant Portal URL": string
          State: string
        }
        Insert: {
          "Grant Portal URL": string
          State: string
        }
        Update: {
          "Grant Portal URL"?: string
          State?: string
        }
        Relationships: []
      }
      State_Grant_Portals: {
        Row: {
          "Grant Portal URL": string | null
          State: string | null
        }
        Insert: {
          "Grant Portal URL"?: string | null
          State?: string | null
        }
        Update: {
          "Grant Portal URL"?: string | null
          State?: string | null
        }
        Relationships: []
      }
      state_grants: {
        Row: {
          agency: string
          category: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          eligibility: string | null
          external_url: string | null
          funding_amount_max: number | null
          funding_amount_min: number | null
          id: string
          opportunity_id: string
          state: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agency: string
          category?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          eligibility?: string | null
          external_url?: string | null
          funding_amount_max?: number | null
          funding_amount_min?: number | null
          id?: string
          opportunity_id: string
          state: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agency?: string
          category?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          eligibility?: string | null
          external_url?: string | null
          funding_amount_max?: number | null
          funding_amount_min?: number | null
          id?: string
          opportunity_id?: string
          state?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subrecipient_monitoring: {
        Row: {
          created_at: string | null
          file_id: string | null
          grant_id: string | null
          id: string
          note_date: string
          notes: string | null
          subrecipient_id: string
        }
        Insert: {
          created_at?: string | null
          file_id?: string | null
          grant_id?: string | null
          id?: string
          note_date: string
          notes?: string | null
          subrecipient_id: string
        }
        Update: {
          created_at?: string | null
          file_id?: string | null
          grant_id?: string | null
          id?: string
          note_date?: string
          notes?: string | null
          subrecipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subrecipient_monitoring_subrecipient_id_fkey"
            columns: ["subrecipient_id"]
            isOneToOne: false
            referencedRelation: "subrecipients"
            referencedColumns: ["id"]
          },
        ]
      }
      subrecipients: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          grant_id: string
          id: string
          mou_file_id: string | null
          name: string
          risk_level: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          grant_id: string
          id?: string
          mou_file_id?: string | null
          name: string
          risk_level?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          grant_id?: string
          id?: string
          mou_file_id?: string | null
          name?: string
          risk_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subrecipients_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subrecipients_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "user_accessible_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_completed: boolean | null
          item_text: string
          order_index: number | null
          task_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_completed?: boolean | null
          item_text: string
          order_index?: number | null
          task_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_completed?: boolean | null
          item_text?: string
          order_index?: number | null
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reminders: {
        Row: {
          created_at: string | null
          id: string
          reminder_type: string
          sent_at: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reminder_type: string
          sent_at?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reminder_type?: string
          sent_at?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          auto_generated: boolean | null
          category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grant_id: string
          id: string
          last_reminder_sent: string | null
          organization_id: string | null
          priority: string
          progress_percentage: number | null
          reminder_date: string | null
          reminder_days_before: number | null
          reminder_enabled: boolean | null
          reminder_sent: boolean | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          auto_generated?: boolean | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          grant_id: string
          id?: string
          last_reminder_sent?: string | null
          organization_id?: string | null
          priority?: string
          progress_percentage?: number | null
          reminder_date?: string | null
          reminder_days_before?: number | null
          reminder_enabled?: boolean | null
          reminder_sent?: boolean | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          auto_generated?: boolean | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          grant_id?: string
          id?: string
          last_reminder_sent?: string | null
          organization_id?: string | null
          priority?: string
          progress_percentage?: number | null
          reminder_date?: string | null
          reminder_days_before?: number | null
          reminder_enabled?: boolean | null
          reminder_sent?: boolean | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          sound_effects_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          sound_effects_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sound_effects_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_types: string[]
          id: string
          is_active: boolean
          last_triggered: string | null
          name: string
          secret_token: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_types?: string[]
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          name: string
          secret_token?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_types?: string[]
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          name?: string
          secret_token?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processing_time_ms: number | null
          response_body: string | null
          response_status: number | null
          triggered_at: string
          webhook_endpoint_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processing_time_ms?: number | null
          response_body?: string | null
          response_status?: number | null
          triggered_at?: string
          webhook_endpoint_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processing_time_ms?: number | null
          response_body?: string | null
          response_status?: number | null
          triggered_at?: string
          webhook_endpoint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_endpoint_id_fkey"
            columns: ["webhook_endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          action_data: Json | null
          action_type: Database["public"]["Enums"]["action_type"]
          completed_at: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          result_data: Json | null
          status: string | null
          step_number: number
          workflow_instance_id: string | null
        }
        Insert: {
          action_data?: Json | null
          action_type: Database["public"]["Enums"]["action_type"]
          completed_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          result_data?: Json | null
          status?: string | null
          step_number: number
          workflow_instance_id?: string | null
        }
        Update: {
          action_data?: Json | null
          action_type?: Database["public"]["Enums"]["action_type"]
          completed_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          result_data?: Json | null
          status?: string | null
          step_number?: number
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          completed_at: string | null
          context_data: Json | null
          created_by: string | null
          current_step: number | null
          entity_id: string | null
          entity_type: string | null
          grant_id: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["workflow_status"] | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          context_data?: Json | null
          created_by?: string | null
          current_step?: number | null
          entity_id?: string | null
          entity_type?: string | null
          grant_id?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"] | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          context_data?: Json | null
          created_by?: string | null
          current_step?: number | null
          entity_id?: string | null
          entity_type?: string | null
          grant_id?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"] | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_conditions: Json | null
          updated_at: string | null
          workflow_steps: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_conditions?: Json | null
          updated_at?: string | null
          workflow_steps?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_conditions?: Json | null
          updated_at?: string | null
          workflow_steps?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      user_accessible_grants: {
        Row: {
          amount_awarded: number | null
          assigned_at: string | null
          coordinator_name: string | null
          created_at: string | null
          end_date: string | null
          funder: string | null
          id: string | null
          organization_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["grant_status"] | null
          title: string | null
          updated_at: string | null
          user_permissions: string[] | null
          user_role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_user: {
        Args: { user_id_param: string; approver_id: string }
        Returns: undefined
      }
      assign_user_to_grant: {
        Args: {
          target_user_id: string
          target_grant_id: string
          grant_role?: string
          grant_permissions?: string[]
        }
        Returns: string
      }
      calculate_budget_summary: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
      calculate_closeout_completion: {
        Args: { p_grant_id: string }
        Returns: number
      }
      calculate_grant_readiness_score: {
        Args: { p_grant_id: string }
        Returns: number
      }
      calculate_grant_readiness_score_enhanced: {
        Args: { p_grant_id: string }
        Returns: number
      }
      check_rls_enforcement: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          rls_enabled: boolean
        }[]
      }
      check_task_deadlines: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_closeout_tasks_for_grant: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
      create_document_version: {
        Args: {
          p_parent_document_id: string
          p_file_name: string
          p_file_path: string
          p_file_size: number
          p_mime_type: string
          p_grant_id: string
          p_change_notes?: string
        }
        Returns: string
      }
      execute_workflow_step: {
        Args: { p_instance_id: string; p_step_number: number }
        Returns: boolean
      }
      generate_deadline_notifications: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_budget_summary: {
        Args: { p_grant_id: string; p_fiscal_year?: number; p_quarter?: number }
        Returns: {
          total_budgeted: number
          total_allocated: number
          total_spent: number
          total_remaining: number
          utilization_rate: number
          category_breakdown: Json
        }[]
      }
      get_financial_summary: {
        Args: {
          p_grant_ids?: string[]
          p_period_start?: string
          p_period_end?: string
        }
        Returns: {
          grant_id: string
          grant_title: string
          total_awarded: number
          total_expenses: number
          remaining_budget: number
          budget_utilization: number
          expense_count: number
        }[]
      }
      get_organization_role: {
        Args: { user_id: string; org_id: string }
        Returns: string
      }
      get_performance_metrics: {
        Args: { p_user_id: string }
        Returns: {
          total_submitted: number
          total_awarded: number
          award_rate: number
          avg_grant_size: number
          avg_time_to_submission: number
        }[]
      }
      get_user_grant_assignments: {
        Args: { user_id_param?: string }
        Returns: {
          grant_id: string
          grant_title: string
          grant_status: string
          user_role: string
          user_permissions: string[]
          assigned_at: string
        }[]
      }
      get_user_grant_ids: {
        Args: { user_id_param?: string }
        Returns: string[]
      }
      get_user_organizations: {
        Args: { user_id: string }
        Returns: {
          org_id: string
          org_name: string
          role: string
          permissions: string[]
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      initialize_closeout_tasks: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
      invite_user: {
        Args: {
          user_email: string
          user_role?: Database["public"]["Enums"]["app_role"]
          user_department?: string
          invited_by_id?: string
        }
        Returns: string
      }
      is_organization_member: {
        Args: { user_id: string; org_id: string }
        Returns: boolean
      }
      log_file_action: {
        Args: {
          p_grant_id: string
          p_file_id: string
          p_file_name: string
          p_action: string
          p_file_path?: string
          p_file_size?: number
          p_mime_type?: string
          p_linked_feature?: string
        }
        Returns: string
      }
      log_grant_activity: {
        Args: {
          p_grant_id: string
          p_action: string
          p_description?: string
          p_payload?: Json
          p_user_id?: string
        }
        Returns: string
      }
      notify_quarterly_report: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      promote_to_workspace: {
        Args: {
          p_bookmark_id: string
          p_award_amount?: number
          p_start_date?: string
          p_end_date?: string
        }
        Returns: string
      }
      remove_user_from_grant: {
        Args: { target_user_id: string; target_grant_id: string }
        Returns: boolean
      }
      sanitize_text_input: {
        Args: { input_text: string }
        Returns: string
      }
      update_grant_progress_section: {
        Args: { p_grant_id: string; p_section: string; p_complete: boolean }
        Returns: undefined
      }
      update_last_login: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      user_has_grant_access: {
        Args: { user_id_param: string; grant_id_param: string }
        Returns: boolean
      }
      user_has_grant_permission: {
        Args: {
          user_id_param: string
          grant_id_param: string
          permission_param: string
        }
        Returns: boolean
      }
      validate_user_permissions: {
        Args: {
          user_id: string
          required_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      action_type:
        | "send_notification"
        | "create_task"
        | "update_status"
        | "send_email"
        | "create_milestone"
        | "generate_report"
      app_role: "admin" | "manager" | "viewer" | "user"
      deadline_type: "report" | "renewal" | "closeout" | "drawdown"
      grant_status: "draft" | "active" | "closed"
      notification_status: "pending" | "sent" | "failed"
      notification_type:
        | "deadline_reminder"
        | "task_assigned"
        | "milestone_due"
        | "report_due"
        | "compliance_overdue"
        | "new_grant_available"
        | "quarterly_report_due"
      report_type: "financial" | "narrative" | "closeout"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "on_hold"
      trigger_type:
        | "deadline_approaching"
        | "task_completed"
        | "milestone_reached"
        | "status_changed"
        | "manual"
        | "scheduled"
      workflow_status: "active" | "paused" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_type: [
        "send_notification",
        "create_task",
        "update_status",
        "send_email",
        "create_milestone",
        "generate_report",
      ],
      app_role: ["admin", "manager", "viewer", "user"],
      deadline_type: ["report", "renewal", "closeout", "drawdown"],
      grant_status: ["draft", "active", "closed"],
      notification_status: ["pending", "sent", "failed"],
      notification_type: [
        "deadline_reminder",
        "task_assigned",
        "milestone_due",
        "report_due",
        "compliance_overdue",
        "new_grant_available",
        "quarterly_report_due",
      ],
      report_type: ["financial", "narrative", "closeout"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "on_hold"],
      trigger_type: [
        "deadline_approaching",
        "task_completed",
        "milestone_reached",
        "status_changed",
        "manual",
        "scheduled",
      ],
      workflow_status: ["active", "paused", "completed", "cancelled"],
    },
  },
} as const
