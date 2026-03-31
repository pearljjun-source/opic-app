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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          content_hash: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          previous_hash: string | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          admin_id: string
          content_hash: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          previous_hash?: string | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          content_hash?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          previous_hash?: string | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          api_type: Database["public"]["Enums"]["api_type"]
          called_at: string | null
          duration_ms: number | null
          id: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          api_type: Database["public"]["Enums"]["api_type"]
          called_at?: string | null
          duration_ms?: number | null
          id?: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          api_type?: Database["public"]["Enums"]["api_type"]
          called_at?: string | null
          duration_ms?: number | null
          id?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      cancellation_feedback: {
        Row: {
          created_at: string | null
          detail: string | null
          final_action: string
          id: string
          offer_accepted: boolean | null
          offer_shown: string | null
          organization_id: string
          reason: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          detail?: string | null
          final_action?: string
          id?: string
          offer_accepted?: boolean | null
          offer_shown?: string | null
          organization_id: string
          reason: string
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          detail?: string | null
          final_action?: string
          id?: string
          offer_accepted?: boolean | null
          offer_shown?: string | null
          organization_id?: string
          reason?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_feedback_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_responses: {
        Row: {
          audio_url: string | null
          combo_number: number | null
          combo_position: number | null
          created_at: string | null
          duration_sec: number | null
          exam_session_id: string
          feedback: Json | null
          id: string
          is_scored: boolean | null
          processing_status: string | null
          question_id: string | null
          question_order: number
          roleplay_question_id: string | null
          score: number | null
          transcription: string | null
        }
        Insert: {
          audio_url?: string | null
          combo_number?: number | null
          combo_position?: number | null
          created_at?: string | null
          duration_sec?: number | null
          exam_session_id: string
          feedback?: Json | null
          id?: string
          is_scored?: boolean | null
          processing_status?: string | null
          question_id?: string | null
          question_order: number
          roleplay_question_id?: string | null
          score?: number | null
          transcription?: string | null
        }
        Update: {
          audio_url?: string | null
          combo_number?: number | null
          combo_position?: number | null
          created_at?: string | null
          duration_sec?: number | null
          exam_session_id?: string
          feedback?: Json | null
          id?: string
          is_scored?: boolean | null
          processing_status?: string | null
          question_id?: string | null
          question_order?: number
          roleplay_question_id?: string | null
          score?: number | null
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_responses_exam_session_id_fkey"
            columns: ["exam_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_responses_roleplay_question_id_fkey"
            columns: ["roleplay_question_id"]
            isOneToOne: false
            referencedRelation: "roleplay_scenario_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          estimated_grade: string | null
          evaluation_report: Json | null
          exam_type: string
          id: string
          organization_id: string | null
          overall_score: number | null
          processing_status: string | null
          roleplay_scenario_id: string | null
          score_accuracy: number | null
          score_content: number | null
          score_function: number | null
          score_text_type: number | null
          self_assessment_level: number | null
          started_at: string | null
          status: string
          student_id: string
          survey_topics: Json | null
          total_duration_sec: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          estimated_grade?: string | null
          evaluation_report?: Json | null
          exam_type: string
          id?: string
          organization_id?: string | null
          overall_score?: number | null
          processing_status?: string | null
          roleplay_scenario_id?: string | null
          score_accuracy?: number | null
          score_content?: number | null
          score_function?: number | null
          score_text_type?: number | null
          self_assessment_level?: number | null
          started_at?: string | null
          status?: string
          student_id: string
          survey_topics?: Json | null
          total_duration_sec?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          estimated_grade?: string | null
          evaluation_report?: Json | null
          exam_type?: string
          id?: string
          organization_id?: string | null
          overall_score?: number | null
          processing_status?: string | null
          roleplay_scenario_id?: string | null
          score_accuracy?: number | null
          score_content?: number | null
          score_function?: number | null
          score_text_type?: number | null
          self_assessment_level?: number | null
          started_at?: string | null
          status?: string
          student_id?: string
          survey_topics?: Json | null
          total_duration_sec?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_roleplay_scenario_id_fkey"
            columns: ["roleplay_scenario_id"]
            isOneToOne: false
            referencedRelation: "roleplay_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_uses: {
        Row: {
          id: string
          invite_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          invite_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          invite_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_uses_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_uses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          class_id: string | null
          code: string
          created_at: string | null
          deleted_at: string | null
          expires_at: string
          id: string
          max_uses: number
          organization_id: string | null
          organization_name: string | null
          status: Database["public"]["Enums"]["invite_status"] | null
          target_role: Database["public"]["Enums"]["org_role"]
          teacher_id: string
          use_count: number
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          class_id?: string | null
          code: string
          created_at?: string | null
          deleted_at?: string | null
          expires_at: string
          id?: string
          max_uses?: number
          organization_id?: string | null
          organization_name?: string | null
          status?: Database["public"]["Enums"]["invite_status"] | null
          target_role?: Database["public"]["Enums"]["org_role"]
          teacher_id: string
          use_count?: number
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          class_id?: string | null
          code?: string
          created_at?: string | null
          deleted_at?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          organization_id?: string | null
          organization_name?: string | null
          status?: Database["public"]["Enums"]["invite_status"] | null
          target_role?: Database["public"]["Enums"]["org_role"]
          teacher_id?: string
          use_count?: number
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          metadata: Json | null
          section_id: string
          sort_order: number
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          section_id: string
          sort_order?: number
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          section_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "landing_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_sections: {
        Row: {
          content: Json | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          section_key: string
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          section_key: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          section_key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          body: string | null
          created_by: string | null
          data: Json | null
          deleted_at: string | null
          id: string
          read_at: string | null
          resource_id: string | null
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_by?: string | null
          data?: Json | null
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          resource_id?: string | null
          sent_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_by?: string | null
          data?: Json | null
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          resource_id?: string | null
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          settings: Json
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          settings?: Json
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          settings?: Json
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          card_last4: string | null
          created_at: string
          currency: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          provider_payment_id: string | null
          receipt_url: string | null
          status: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          amount: number
          card_last4?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          provider_payment_id?: string | null
          receipt_url?: string | null
          status?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          amount?: number
          card_last4?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          provider_payment_id?: string | null
          receipt_url?: string | null
          status?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          audio_url: string
          created_at: string | null
          deleted_at: string | null
          duration: number | null
          feedback: Json | null
          id: string
          organization_id: string | null
          reproduction_rate: number | null
          score: number | null
          script_id: string
          student_id: string
          transcription: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          feedback?: Json | null
          id?: string
          organization_id?: string | null
          reproduction_rate?: number | null
          score?: number | null
          script_id: string
          student_id: string
          transcription?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          feedback?: Json | null
          id?: string
          organization_id?: string | null
          reproduction_rate?: number | null
          score?: number | null
          script_id?: string
          student_id?: string
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practices_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          audio_url: string | null
          created_at: string | null
          difficulty: number
          hint_ko: string | null
          id: string
          is_active: boolean | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          sort_order: number | null
          topic_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          difficulty: number
          hint_ko?: string | null
          id?: string
          is_active?: boolean | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          sort_order?: number | null
          topic_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          difficulty?: number
          hint_ko?: string | null
          id?: string
          is_active?: boolean | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          sort_order?: number | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_scenario_questions: {
        Row: {
          audio_url: string | null
          hint_ko: string | null
          id: string
          position: number
          question_text: string
          roleplay_type: string
          scenario_id: string
        }
        Insert: {
          audio_url?: string | null
          hint_ko?: string | null
          id?: string
          position: number
          question_text: string
          roleplay_type: string
          scenario_id: string
        }
        Update: {
          audio_url?: string | null
          hint_ko?: string | null
          id?: string
          position?: number
          question_text?: string
          roleplay_type?: string
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_scenario_questions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "roleplay_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_scenarios: {
        Row: {
          category: string | null
          created_at: string | null
          description_ko: string | null
          difficulty: number
          id: string
          is_active: boolean | null
          scenario_context: string
          sort_order: number | null
          title_en: string
          title_ko: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description_ko?: string | null
          difficulty: number
          id?: string
          is_active?: boolean | null
          scenario_context: string
          sort_order?: number | null
          title_en: string
          title_ko: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description_ko?: string | null
          difficulty?: number
          id?: string
          is_active?: boolean | null
          scenario_context?: string
          sort_order?: number | null
          title_en?: string
          title_ko?: string
        }
        Relationships: []
      }
      script_views: {
        Row: {
          deleted_at: string | null
          id: string
          script_id: string
          viewed_at: string | null
        }
        Insert: {
          deleted_at?: string | null
          id?: string
          script_id: string
          viewed_at?: string | null
        }
        Update: {
          deleted_at?: string | null
          id?: string
          script_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_views_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          comment: string | null
          content: string
          content_ko: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          organization_id: string | null
          question_id: string
          status: Database["public"]["Enums"]["script_status"] | null
          student_id: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          content: string
          content_ko?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string | null
          question_id: string
          status?: Database["public"]["Enums"]["script_status"] | null
          student_id: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          content?: string
          content_ko?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string | null
          question_id?: string
          status?: Database["public"]["Enums"]["script_status"] | null
          student_id?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_topics: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          student_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          student_id: string
          topic_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          student_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_topics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      student_survey_profiles: {
        Row: {
          id: string
          student_id: string
          job_type: string
          is_student: boolean
          student_type: string | null
          residence_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          job_type: string
          is_student?: boolean
          student_type?: string | null
          residence_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          job_type?: string
          is_student?: boolean
          student_type?: string | null
          residence_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_survey_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          ai_feedback_enabled: boolean
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_scripts: number
          max_students: number
          name: string
          plan_key: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          tts_enabled: boolean
          updated_at: string
        }
        Insert: {
          ai_feedback_enabled?: boolean
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_scripts?: number
          max_students?: number
          name: string
          plan_key: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          tts_enabled?: boolean
          updated_at?: string
        }
        Update: {
          ai_feedback_enabled?: boolean
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_scripts?: number
          max_students?: number
          name?: string
          plan_key?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          tts_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          billing_key: string | null
          billing_provider: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          dunning_started_at: string | null
          id: string
          organization_id: string | null
          pending_plan_id: string | null
          plan_id: string
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          billing_key?: string | null
          billing_provider?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start?: string
          dunning_started_at?: string | null
          id?: string
          organization_id?: string | null
          pending_plan_id?: string | null
          plan_id: string
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          billing_key?: string | null
          billing_provider?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          dunning_started_at?: string | null
          id?: string
          organization_id?: string | null
          pending_plan_id?: string | null
          plan_id?: string
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_feedbacks: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          feedback: string
          id: string
          practice_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          feedback: string
          id?: string
          practice_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          feedback?: string
          id?: string
          practice_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_feedbacks_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_feedbacks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_student: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          student_id: string
          target_opic_grade: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          student_id: string
          target_opic_grade?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          student_id?: string
          target_opic_grade?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_groups: {
        Row: {
          id: string
          name_ko: string
          name_en: string
          selection_type: string
          min_selections: number
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name_ko: string
          name_en: string
          selection_type?: string
          min_selections?: number
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string
          selection_type?: string
          min_selections?: number
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_ko: string
          sort_order: number | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_ko: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          marketing_agreed: boolean | null
          marketing_agreed_at: string | null
          privacy_agreed: boolean | null
          privacy_agreed_at: string | null
          terms_agreed: boolean | null
          terms_agreed_at: string | null
          user_id: string
          voice_data_agreed: boolean | null
          voice_data_agreed_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          marketing_agreed?: boolean | null
          marketing_agreed_at?: string | null
          privacy_agreed?: boolean | null
          privacy_agreed_at?: string | null
          terms_agreed?: boolean | null
          terms_agreed_at?: string | null
          user_id: string
          voice_data_agreed?: boolean | null
          voice_data_agreed_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          marketing_agreed?: boolean | null
          marketing_agreed_at?: string | null
          privacy_agreed?: boolean | null
          privacy_agreed_at?: string | null
          terms_agreed?: boolean | null
          terms_agreed_at?: string | null
          user_id?: string
          voice_data_agreed?: boolean | null
          voice_data_agreed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string
          id: string
          name: string
          platform_role: Database["public"]["Enums"]["platform_role"] | null
          push_token: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email: string
          id: string
          name: string
          platform_role?: Database["public"]["Enums"]["platform_role"] | null
          push_token?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          id?: string
          name?: string
          platform_role?: Database["public"]["Enums"]["platform_role"] | null
          push_token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _check_org_quota: {
        Args: { p_feature_key: string; p_org_id: string }
        Returns: Json
      }
      _entitlement_free_default: {
        Args: { p_feature_key: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
      add_class_member: {
        Args: { p_class_id: string; p_student_id: string }
        Returns: Json
      }
      admin_cancel_subscription: {
        Args: { p_immediate?: boolean; p_org_id: string }
        Returns: Json
      }
      admin_change_user_role: {
        Args: { p_new_role: string; p_user_id: string }
        Returns: Json
      }
      admin_create_owner_invite: {
        Args: { p_expires_in_days?: number; p_org_name: string }
        Returns: Json
      }
      admin_delete_landing_item: { Args: { p_item_id: string }; Returns: Json }
      admin_delete_organization: {
        Args: { p_org_id: string; p_reason?: string }
        Returns: Json
      }
      admin_delete_owner_invite: {
        Args: { p_invite_id: string }
        Returns: Json
      }
      admin_get_cancellation_stats: { Args: never; Returns: Json }
      admin_get_org_payments: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: Json
      }
      admin_get_organization_detail: {
        Args: { p_org_id: string }
        Returns: Json
      }
      admin_get_subscription_stats: { Args: never; Returns: Json }
      admin_get_user_by_id: { Args: { p_user_id: string }; Returns: Json }
      admin_list_organizations: { Args: never; Returns: Json }
      admin_list_owner_invites: { Args: never; Returns: Json }
      admin_list_users:
        | {
            Args: {
              p_page?: number
              p_per_page?: number
              p_role?: Database["public"]["Enums"]["user_role"]
              p_search?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_limit?: number
              p_offset?: number
              p_role?: string
              p_search?: string
            }
            Returns: Json
          }
      admin_reorder_items: { Args: { p_items: Json }; Returns: Json }
      admin_update_landing_section: {
        Args: { p_section_key: string; p_updates: Json }
        Returns: Json
      }
      admin_update_organization: {
        Args: { p_org_id: string; p_updates: Json }
        Returns: Json
      }
      admin_update_plan: {
        Args: { p_plan_id: string; p_updates: Json }
        Returns: Json
      }
      admin_update_subscription: {
        Args: { p_org_id: string; p_plan_key: string }
        Returns: Json
      }
      admin_upsert_landing_item: { Args: { p_item: Json }; Returns: Json }
      can_teach_in_org: { Args: { p_org_id: string }; Returns: boolean }
      change_member_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["org_role"]
          p_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      check_api_rate_limit: {
        Args: {
          p_api_type: Database["public"]["Enums"]["api_type"]
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_exam_availability: {
        Args: { p_exam_type: string; p_question_count?: number }
        Returns: Json
      }
      check_org_entitlement: { Args: { p_feature_key: string }; Returns: Json }
      cleanup_expired_invites: { Args: never; Returns: number }
      create_class: {
        Args: { p_description?: string; p_name: string }
        Returns: Json
      }
      create_invite: {
        Args: {
          p_class_id?: string
          p_expires_in_days?: number
          p_max_uses?: number
          p_target_role?: Database["public"]["Enums"]["org_role"]
        }
        Returns: Json
      }
      generate_invite_code: { Args: never; Returns: string }
      generate_level_test_questions: { Args: never; Returns: Json }
      generate_mock_exam_questions: {
        Args: { p_self_assessment: number; p_survey_topic_ids: string[] }
        Returns: Json
      }
      get_admin_dashboard_stats: { Args: never; Returns: Json }
      get_class_detail: { Args: { p_class_id: string }; Returns: Json }
      get_invite_usage_stats: { Args: { p_invite_id: string }; Returns: Json }
      get_my_organizations: {
        Args: never
        Returns: {
          id: string
          member_count: number
          name: string
          role: Database["public"]["Enums"]["org_role"]
        }[]
      }
      get_org_teachers: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["org_role"]
          students_count: number
        }[]
      }
      get_plan_yearly_discount: { Args: { p_plan_key: string }; Returns: Json }
      get_practice_streak: { Args: { p_student_id: string }; Returns: Json }
      get_script_view_count: { Args: { p_script_id: string }; Returns: number }
      get_student_detail: { Args: { p_student_id: string }; Returns: Json }
      get_student_practice_stats: {
        Args: { p_student_id: string }
        Returns: Json
      }
      get_student_practices: {
        Args: { p_student_id: string }
        Returns: {
          audio_url: string
          created_at: string
          difficulty: number
          duration: number
          feedback: Json
          id: string
          question_id: string
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          reproduction_rate: number
          score: number
          script_content: string
          script_id: string
          script_status: Database["public"]["Enums"]["script_status"]
          student_id: string
          teacher_feedback_at: string
          teacher_feedback_id: string
          teacher_feedback_text: string
          topic_icon: string
          topic_id: string
          topic_name_en: string
          topic_name_ko: string
          transcription: string
        }[]
      }
      get_student_scripts: {
        Args: { p_student_id: string }
        Returns: {
          best_reproduction_rate: number
          best_score: number
          comment: string
          content: string
          created_at: string
          difficulty: number
          hint_ko: string
          id: string
          last_practice_at: string
          practices_count: number
          question_id: string
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          status: Database["public"]["Enums"]["script_status"]
          student_id: string
          teacher_id: string
          topic_icon: string
          topic_id: string
          topic_name_en: string
          topic_name_ko: string
          updated_at: string
        }[]
      }
      get_student_topics_with_progress: {
        Args: { p_student_id: string }
        Returns: {
          best_avg_score: number
          last_practice_at: string
          practices_count: number
          scripts_count: number
          topic_category: string
          topic_icon: string
          topic_id: string
          topic_name_en: string
          topic_name_ko: string
          topic_sort_order: number
          total_questions: number
        }[]
      }
      get_survey_profile: {
        Args: { p_student_id: string }
        Returns: Json
      }
      save_survey_profile: {
        Args: {
          p_student_id: string
          p_job_type: string
          p_is_student: boolean
          p_student_type: string | null
          p_residence_type: string
        }
        Returns: Json
      }
      get_teacher_classes: {
        Args: { p_org_id?: string }
        Returns: {
          created_at: string
          description: string
          id: string
          member_count: number
          name: string
          updated_at: string
        }[]
      }
      get_teacher_students: {
        Args: { p_org_id?: string }
        Returns: {
          avg_reproduction_rate: number
          avg_score: number
          created_at: string
          email: string
          id: string
          last_practice_at: string
          name: string
          pending_feedback_count: number
          practices_count: number
          scripts_count: number
          this_week_practices: number
        }[]
      }
      get_topic_questions_with_scripts: {
        Args: { p_student_id: string; p_topic_id: string }
        Returns: {
          audio_url: string
          best_reproduction_rate: number
          best_score: number
          difficulty: number
          hint_ko: string
          last_practice_at: string
          practices_count: number
          question_id: string
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          script_content: string
          script_created_at: string
          script_id: string
          script_status: Database["public"]["Enums"]["script_status"]
          sort_order: number
        }[]
      }
      get_user_org_role: {
        Args: { p_org_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_user_role: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_connected_student: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: {
          p_org_id: string
          p_roles?: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      log_api_usage: {
        Args: {
          p_api_type: Database["public"]["Enums"]["api_type"]
          p_duration_ms?: number
          p_tokens_used?: number
          p_user_id: string
        }
        Returns: string
      }
      notify_action: {
        Args: { p_resource_id: string; p_type: string }
        Returns: Json
      }
      promote_to_teacher: { Args: { p_user_id: string }; Returns: Json }
      remove_class_member: {
        Args: { p_class_id: string; p_student_id: string }
        Returns: Json
      }
      remove_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      set_student_topics: {
        Args: { p_student_id: string; p_topic_ids: string[] }
        Returns: Json
      }
      soft_delete_class: { Args: { p_class_id: string }; Returns: Json }
      soft_delete_connection: {
        Args: { p_connection_id: string }
        Returns: Json
      }
      soft_delete_invite: { Args: { p_invite_id: string }; Returns: Json }
      soft_delete_script: { Args: { p_script_id: string }; Returns: Json }
      soft_delete_student_topic: {
        Args: { p_student_topic_id: string }
        Returns: Json
      }
      soft_delete_user: { Args: { p_user_id: string }; Returns: Json }
      update_class: {
        Args: { p_class_id: string; p_description?: string; p_name?: string }
        Returns: Json
      }
      update_organization_name: {
        Args: { p_name: string; p_org_id: string }
        Returns: Json
      }
      update_student_notes: {
        Args: {
          p_notes?: string
          p_student_id: string
          p_target_grade?: string
        }
        Returns: Json
      }
      use_invite_code: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      api_type: "whisper" | "claude" | "tts"
      billing_cycle: "monthly" | "yearly"
      invite_status: "pending" | "used" | "expired"
      org_role: "owner" | "teacher" | "student"
      platform_role: "super_admin"
      question_type:
        | "describe"
        | "routine"
        | "experience"
        | "comparison"
        | "roleplay"
        | "advanced"
      script_status: "draft" | "complete"
      user_role: "admin" | "teacher" | "student"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      api_type: ["whisper", "claude", "tts"],
      billing_cycle: ["monthly", "yearly"],
      invite_status: ["pending", "used", "expired"],
      org_role: ["owner", "teacher", "student"],
      platform_role: ["super_admin"],
      question_type: [
        "describe",
        "routine",
        "experience",
        "comparison",
        "roleplay",
        "advanced",
      ],
      script_status: ["draft", "complete"],
      user_role: ["admin", "teacher", "student"],
    },
  },
} as const
