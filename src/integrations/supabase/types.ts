export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          id: string
          owner_id: string
          project_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          id?: string
          owner_id: string
          project_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          id?: string
          owner_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linked_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions: {
        Row: {
          approved_at: string | null
          created_at: string
          executed_at: string | null
          id: string
          kind: string
          organization_id: string | null
          owner_id: string
          payload: Json
          priority: number
          reasoning: string | null
          result: Json | null
          run_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          kind: string
          organization_id?: string | null
          owner_id: string
          payload?: Json
          priority?: number
          reasoning?: string | null
          result?: Json | null
          run_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          id?: string
          kind?: string
          organization_id?: string | null
          owner_id?: string
          payload?: Json
          priority?: number
          reasoning?: string | null
          result?: Json | null
          run_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          actions_count: number
          error: string | null
          finished_at: string | null
          id: string
          model: string | null
          organization_id: string | null
          owner_id: string
          started_at: string
          status: string
          summary: string | null
          tokens_used: number | null
          trigger: string
        }
        Insert: {
          actions_count?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          model?: string | null
          organization_id?: string | null
          owner_id: string
          started_at?: string
          status?: string
          summary?: string | null
          tokens_used?: number | null
          trigger?: string
        }
        Update: {
          actions_count?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          model?: string | null
          organization_id?: string | null
          owner_id?: string
          started_at?: string
          status?: string
          summary?: string | null
          tokens_used?: number | null
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          auto_run_on_new_lead: boolean
          cadence_minutes: number
          created_at: string
          enabled: boolean
          last_run_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_run_on_new_lead?: boolean
          cadence_minutes?: number
          created_at?: string
          enabled?: boolean
          last_run_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_run_on_new_lead?: boolean
          cadence_minutes?: number
          created_at?: string
          enabled?: boolean
          last_run_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          organization_id: string
          owner_id: string
          scheduled_at: string
          service_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          owner_id: string
          scheduled_at: string
          service_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string
          scheduled_at?: string
          service_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          project_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linked_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          payload: Json
          project_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          payload?: Json
          project_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          project_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linked_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          amount: string | null
          created_at: string
          deadline: string | null
          draft_application: string | null
          eligibility: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          owner_id: string
          provider: string | null
          status: string
          updated_at: string
          url: string | null
        }
        Insert: {
          amount?: string | null
          created_at?: string
          deadline?: string | null
          draft_application?: string | null
          eligibility?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          owner_id: string
          provider?: string | null
          status?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          amount?: string | null
          created_at?: string
          deadline?: string | null
          draft_application?: string | null
          eligibility?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          owner_id?: string
          provider?: string | null
          status?: string
          updated_at?: string
          url?: string | null
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
      ideas: {
        Row: {
          body: string | null
          created_at: string
          id: string
          owner_id: string
          priority: number
          project_id: string | null
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          owner_id: string
          priority?: number
          project_id?: string | null
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          priority?: number
          project_id?: string | null
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linked_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          last_event_at: string | null
          location: string | null
          name: string
          owner_id: string
          project_id: string | null
          quantity: number
          sku: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_event_at?: string | null
          location?: string | null
          name: string
          owner_id: string
          project_id?: string | null
          quantity?: number
          sku?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_event_at?: string | null
          location?: string | null
          name?: string
          owner_id?: string
          project_id?: string | null
          quantity?: number
          sku?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linked_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          check_size: string | null
          created_at: string
          email: string | null
          firm: string | null
          focus: string | null
          id: string
          last_contacted_at: string | null
          linkedin: string | null
          name: string
          notes: string | null
          organization_id: string | null
          owner_id: string
          stage: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          check_size?: string | null
          created_at?: string
          email?: string | null
          firm?: string | null
          focus?: string | null
          id?: string
          last_contacted_at?: string | null
          linkedin?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          owner_id: string
          stage?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          check_size?: string | null
          created_at?: string
          email?: string | null
          firm?: string | null
          focus?: string | null
          id?: string
          last_contacted_at?: string | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          owner_id?: string
          stage?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_files: {
        Row: {
          created_at: string
          extracted_text: string | null
          filename: string
          id: string
          mime_type: string | null
          organization_id: string | null
          owner_id: string
          size_bytes: number | null
          storage_path: string
          summary: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          organization_id?: string | null
          owner_id: string
          size_bytes?: number | null
          storage_path: string
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          organization_id?: string | null
          owner_id?: string
          size_bytes?: number | null
          storage_path?: string
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string | null
          follow_up_at: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          project_id: string | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          follow_up_at?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          project_id?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          follow_up_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          project_id?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "linked_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_projects: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          color: string
          created_at: string
          event_count: number
          id: string
          last_seen_at: string | null
          name: string
          organization_id: string | null
          owner_id: string
          slug: string
          updated_at: string
          url: string | null
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          color?: string
          created_at?: string
          event_count?: number
          id?: string
          last_seen_at?: string | null
          name: string
          organization_id?: string | null
          owner_id: string
          slug: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          color?: string
          created_at?: string
          event_count?: number
          id?: string
          last_seen_at?: string | null
          name?: string
          organization_id?: string | null
          owner_id?: string
          slug?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linked_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          owner_id: string
          slug: string
          square_enabled: boolean
          square_location_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          owner_id: string
          slug: string
          square_enabled?: boolean
          square_location_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          slug?: string
          square_enabled?: boolean
          square_location_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      price_change_requests: {
        Row: {
          applied_at: string | null
          change_type: string
          created_at: string
          id: string
          organization_id: string
          owner_id: string
          payload: Json
          propagation_log: Json
          reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_id: string | null
          square_synced: boolean
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          change_type: string
          created_at?: string
          id?: string
          organization_id: string
          owner_id: string
          payload?: Json
          propagation_log?: Json
          reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_id?: string | null
          square_synced?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          change_type?: string
          created_at?: string
          id?: string
          organization_id?: string
          owner_id?: string
          payload?: Json
          propagation_log?: Json
          reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_id?: string | null
          square_synced?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_change_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number | null
          id: string
          name: string
          organization_id: string
          owner_id: string
          price_cents: number
          sku: string | null
          square_catalog_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name: string
          organization_id: string
          owner_id: string
          price_cents?: number
          sku?: string | null
          square_catalog_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string
          price_cents?: number
          sku?: string | null
          square_catalog_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      square_sync_log: {
        Row: {
          action: string
          created_at: string
          id: string
          organization_id: string
          owner_id: string
          response: Json | null
          service_id: string | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          organization_id: string
          owner_id: string
          response?: Json | null
          service_id?: string | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          organization_id?: string
          owner_id?: string
          response?: Json | null
          service_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "square_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "square_sync_log_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
