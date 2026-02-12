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
  public: {
    Tables: {
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
      invites: {
        Row: {
          code: string
          created_at: string | null
          deleted_at: string | null
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["invite_status"] | null
          teacher_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          deleted_at?: string | null
          expires_at: string
          id?: string
          status?: Database["public"]["Enums"]["invite_status"] | null
          teacher_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          deleted_at?: string | null
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["invite_status"] | null
          teacher_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
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
      notification_logs: {
        Row: {
          body: string | null
          data: Json | null
          deleted_at: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          data?: Json | null
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          data?: Json | null
          deleted_at?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_user_id_fkey"
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
          reproduction_rate?: number | null
          score?: number | null
          script_id?: string
          student_id?: string
          transcription?: string | null
        }
        Relationships: [
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
          created_at: string | null
          deleted_at: string | null
          id: string
          question_id: string
          status: Database["public"]["Enums"]["script_status"] | null
          student_id: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          content: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          question_id: string
          status?: Database["public"]["Enums"]["script_status"] | null
          student_id: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          question_id?: string
          status?: Database["public"]["Enums"]["script_status"] | null
          student_id?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
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
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
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
      topics: {
        Row: {
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
          push_token: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email: string
          id: string
          name: string
          push_token?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          id?: string
          name?: string
          push_token?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_api_rate_limit: {
        Args: {
          p_api_type: Database["public"]["Enums"]["api_type"]
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      cleanup_expired_invites: { Args: never; Returns: number }
      create_invite: { Args: { p_expires_in_days?: number }; Returns: Json }
      generate_invite_code: { Args: never; Returns: string }
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
      get_teacher_students: {
        Args: never
        Returns: {
          avg_reproduction_rate: number
          avg_score: number
          created_at: string
          email: string
          id: string
          last_practice_at: string
          name: string
          practices_count: number
          role: Database["public"]["Enums"]["user_role"]
          scripts_count: number
        }[]
      }
      get_user_role: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_connected_student: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: boolean
      }
      log_api_usage: {
        Args: {
          p_api_type: Database["public"]["Enums"]["api_type"]
          p_duration_ms?: number
          p_tokens_used?: number
          p_user_id: string
        }
        Returns: string
      }
      soft_delete_connection: {
        Args: { p_connection_id: string }
        Returns: Json
      }
      soft_delete_script: { Args: { p_script_id: string }; Returns: Json }
      soft_delete_student_topic: {
        Args: { p_student_topic_id: string }
        Returns: Json
      }
      soft_delete_user: { Args: { p_user_id: string }; Returns: Json }
      use_invite_code: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      api_type: "whisper" | "claude" | "tts"
      invite_status: "pending" | "used" | "expired"
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
  public: {
    Enums: {
      api_type: ["whisper", "claude", "tts"],
      invite_status: ["pending", "used", "expired"],
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
