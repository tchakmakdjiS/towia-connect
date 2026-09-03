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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          messages: Json
          mission_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          messages?: Json
          mission_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          messages?: Json
          mission_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistance_requests: {
        Row: {
          address: string | null
          answers: Json
          city: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          messages: Json
          mission_id: string | null
          postal_code: string | null
          problem_description: string | null
          safety_notice: string | null
          service_type: Database["public"]["Enums"]["mission_category"] | null
          status: string
          updated_at: string
          urgency: Database["public"]["Enums"]["mission_priority"]
          user_id: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_registration: string | null
          vehicle_year: number | null
        }
        Insert: {
          address?: string | null
          answers?: Json
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          messages?: Json
          mission_id?: string | null
          postal_code?: string | null
          problem_description?: string | null
          safety_notice?: string | null
          service_type?: Database["public"]["Enums"]["mission_category"] | null
          status?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["mission_priority"]
          user_id: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
          vehicle_year?: number | null
        }
        Update: {
          address?: string | null
          answers?: Json
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          messages?: Json
          mission_id?: string | null
          postal_code?: string | null
          problem_description?: string | null
          safety_notice?: string | null
          service_type?: Database["public"]["Enums"]["mission_category"] | null
          status?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["mission_priority"]
          user_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assistance_requests_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          intervention_zone: string | null
          is_active: boolean
          is_demo: boolean
          legal_name: string | null
          logo_url: string | null
          manager_name: string | null
          name: string
          operators_count: number | null
          owner_id: string
          phone: string | null
          postal_code: string | null
          siret: string | null
          updated_at: string
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          intervention_zone?: string | null
          is_active?: boolean
          is_demo?: boolean
          legal_name?: string | null
          logo_url?: string | null
          manager_name?: string | null
          name: string
          operators_count?: number | null
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          intervention_zone?: string | null
          is_active?: boolean
          is_demo?: boolean
          legal_name?: string | null
          logo_url?: string | null
          manager_name?: string | null
          name?: string
          operators_count?: number | null
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      documents: {
        Row: {
          company_id: string | null
          created_at: string
          expires_at: string | null
          file_url: string | null
          id: string
          is_demo: boolean
          name: string
          operator_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["verification_status"]
          storage_path: string | null
          type: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          is_demo?: boolean
          name: string
          operator_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path?: string | null
          type?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          operator_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          id: string
          is_demo: boolean
          name: string
          quantity: number
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          quantity?: number
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          company_id: string | null
          created_at: string
          currency: string
          id: string
          invoice_number: string
          is_demo: boolean
          issued_at: string
          mission_id: string
          operator_id: string | null
          payment_id: string | null
          pdf_url: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
        }
        Insert: {
          client_id: string
          company_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_number: string
          is_demo?: boolean
          issued_at?: string
          mission_id: string
          operator_id?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Update: {
          client_id?: string
          company_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string
          is_demo?: boolean
          issued_at?: string
          mission_id?: string
          operator_id?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_ai_analysis: {
        Row: {
          category: Database["public"]["Enums"]["mission_category"] | null
          confidence: number | null
          created_at: string
          id: string
          mission_id: string
          needs: string[]
          priority: Database["public"]["Enums"]["mission_priority"] | null
          raw: Json | null
          summary_for_operator: string | null
          vehicle_summary: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["mission_category"] | null
          confidence?: number | null
          created_at?: string
          id?: string
          mission_id: string
          needs?: string[]
          priority?: Database["public"]["Enums"]["mission_priority"] | null
          raw?: Json | null
          summary_for_operator?: string | null
          vehicle_summary?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["mission_category"] | null
          confidence?: number | null
          created_at?: string
          id?: string
          mission_id?: string
          needs?: string[]
          priority?: Database["public"]["Enums"]["mission_priority"] | null
          raw?: Json | null
          summary_for_operator?: string | null
          vehicle_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_ai_analysis_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          label: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          mission_id: string
          previous_status: Database["public"]["Enums"]["mission_status"] | null
          status: Database["public"]["Enums"]["mission_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          label: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          mission_id: string
          previous_status?: Database["public"]["Enums"]["mission_status"] | null
          status?: Database["public"]["Enums"]["mission_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          label?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          mission_id?: string
          previous_status?: Database["public"]["Enums"]["mission_status"] | null
          status?: Database["public"]["Enums"]["mission_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_offers: {
        Row: {
          distance_km: number | null
          estimated_arrival: string | null
          expires_at: string | null
          id: string
          is_demo: boolean
          mission_id: string
          offered_at: string
          operator_id: string
          responded_at: string | null
          score: number | null
          status: Database["public"]["Enums"]["offer_status"]
        }
        Insert: {
          distance_km?: number | null
          estimated_arrival?: string | null
          expires_at?: string | null
          id?: string
          is_demo?: boolean
          mission_id: string
          offered_at?: string
          operator_id: string
          responded_at?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Update: {
          distance_km?: number | null
          estimated_arrival?: string | null
          expires_at?: string | null
          id?: string
          is_demo?: boolean
          mission_id?: string
          offered_at?: string
          operator_id?: string
          responded_at?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "mission_offers_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_offers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_photos: {
        Row: {
          created_at: string
          id: string
          mission_id: string | null
          request_id: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id?: string | null
          request_id?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string | null
          request_id?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_photos_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_photos_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "assistance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          accepted_at: string | null
          address: string | null
          amount: number | null
          arrival_at: string | null
          cancelled_at: string | null
          category: Database["public"]["Enums"]["mission_category"]
          city: string | null
          client_id: string
          company_id: string | null
          completed_at: string | null
          created_at: string
          departure_time: string | null
          description: string | null
          distance_km: number | null
          estimated_amount: number | null
          id: string
          is_demo: boolean
          latitude: number | null
          longitude: number | null
          operator_comment: string | null
          operator_id: string | null
          payment_status: string
          photo_url: string | null
          postal_code: string | null
          price_breakdown: Json | null
          priority: Database["public"]["Enums"]["mission_priority"]
          request_id: string | null
          status: Database["public"]["Enums"]["mission_status"]
          updated_at: string
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_registration: string | null
          vehicle_year: number | null
          work_done: string | null
        }
        Insert: {
          accepted_at?: string | null
          address?: string | null
          amount?: number | null
          arrival_at?: string | null
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["mission_category"]
          city?: string | null
          client_id: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          departure_time?: string | null
          description?: string | null
          distance_km?: number | null
          estimated_amount?: number | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          operator_comment?: string | null
          operator_id?: string | null
          payment_status?: string
          photo_url?: string | null
          postal_code?: string | null
          price_breakdown?: Json | null
          priority?: Database["public"]["Enums"]["mission_priority"]
          request_id?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          vehicle_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
          vehicle_year?: number | null
          work_done?: string | null
        }
        Update: {
          accepted_at?: string | null
          address?: string | null
          amount?: number | null
          arrival_at?: string | null
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["mission_category"]
          city?: string | null
          client_id?: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          departure_time?: string | null
          description?: string | null
          distance_km?: number | null
          estimated_amount?: number | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          operator_comment?: string | null
          operator_id?: string | null
          payment_status?: string
          photo_url?: string | null
          postal_code?: string | null
          price_breakdown?: Json | null
          priority?: Database["public"]["Enums"]["mission_priority"]
          request_id?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string
          vehicle_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string | null
          vehicle_year?: number | null
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "assistance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event: string
          id: string
          is_demo: boolean
          mission_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event: string
          id?: string
          is_demo?: boolean
          mission_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event?: string
          id?: string
          is_demo?: boolean
          mission_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_pricing: {
        Row: {
          active: boolean
          base_price: number
          company_id: string | null
          created_at: string
          emergency_surcharge: number
          id: string
          minimum_price: number
          night_surcharge: number
          operator_id: string | null
          price_per_km: number
          service_type: Database["public"]["Enums"]["mission_category"]
          updated_at: string
          weekend_surcharge: number
        }
        Insert: {
          active?: boolean
          base_price?: number
          company_id?: string | null
          created_at?: string
          emergency_surcharge?: number
          id?: string
          minimum_price?: number
          night_surcharge?: number
          operator_id?: string | null
          price_per_km?: number
          service_type: Database["public"]["Enums"]["mission_category"]
          updated_at?: string
          weekend_surcharge?: number
        }
        Update: {
          active?: boolean
          base_price?: number
          company_id?: string | null
          created_at?: string
          emergency_surcharge?: number
          id?: string
          minimum_price?: number
          night_surcharge?: number
          operator_id?: string | null
          price_per_km?: number
          service_type?: Database["public"]["Enums"]["mission_category"]
          updated_at?: string
          weekend_surcharge?: number
        }
        Relationships: [
          {
            foreignKeyName: "operator_pricing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_pricing_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          address: string | null
          availability: Database["public"]["Enums"]["availability_status"]
          available_24_7: boolean
          city: string | null
          company_id: string | null
          company_name: string | null
          created_at: string
          email: string | null
          equipment: string[]
          first_name: string | null
          iban: string | null
          id: string
          intervention_zone: string | null
          is_available: boolean
          is_demo: boolean
          last_latitude: number | null
          last_longitude: number | null
          last_name: string | null
          last_position_at: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          professional_name: string | null
          rating: number | null
          service_radius_km: number
          services: string[]
          siret: string | null
          updated_at: string
          user_id: string | null
          vehicle_label: string | null
          vehicle_type: string | null
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          address?: string | null
          availability?: Database["public"]["Enums"]["availability_status"]
          available_24_7?: boolean
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          equipment?: string[]
          first_name?: string | null
          iban?: string | null
          id?: string
          intervention_zone?: string | null
          is_available?: boolean
          is_demo?: boolean
          last_latitude?: number | null
          last_longitude?: number | null
          last_name?: string | null
          last_position_at?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          professional_name?: string | null
          rating?: number | null
          service_radius_km?: number
          services?: string[]
          siret?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_label?: string | null
          vehicle_type?: string | null
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          address?: string | null
          availability?: Database["public"]["Enums"]["availability_status"]
          available_24_7?: boolean
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          equipment?: string[]
          first_name?: string | null
          iban?: string | null
          id?: string
          intervention_zone?: string | null
          is_available?: boolean
          is_demo?: boolean
          last_latitude?: number | null
          last_longitude?: number | null
          last_name?: string | null
          last_position_at?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          professional_name?: string | null
          rating?: number | null
          service_radius_km?: number
          services?: string[]
          siret?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_label?: string | null
          vehicle_type?: string | null
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "operators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          breakdown: Json | null
          cancelled_at: string | null
          client_id: string
          commission_rate: number
          company_id: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          is_demo: boolean
          is_test: boolean
          mission_id: string
          operator_id: string | null
          paid_at: string | null
          platform_fee: number
          professional_amount: number
          provider_payment_id: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount?: number
          breakdown?: Json | null
          cancelled_at?: string | null
          client_id: string
          commission_rate?: number
          company_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          is_demo?: boolean
          is_test?: boolean
          mission_id: string
          operator_id?: string | null
          paid_at?: string | null
          platform_fee?: number
          professional_amount?: number
          provider_payment_id?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          breakdown?: Json | null
          cancelled_at?: string | null
          client_id?: string
          commission_rate?: number
          company_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          is_demo?: boolean
          is_test?: boolean
          mission_id?: string
          operator_id?: string | null
          paid_at?: string | null
          platform_fee?: number
          professional_amount?: number
          provider_payment_id?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          emergency_surcharge: number
          id: string
          minimum_price: number
          name: string
          night_surcharge: number
          price_per_km: number
          service_type: Database["public"]["Enums"]["mission_category"]
          updated_at: string
          weekend_surcharge: number
        }
        Insert: {
          active?: boolean
          base_price?: number
          created_at?: string
          emergency_surcharge?: number
          id?: string
          minimum_price?: number
          name: string
          night_surcharge?: number
          price_per_km?: number
          service_type: Database["public"]["Enums"]["mission_category"]
          updated_at?: string
          weekend_surcharge?: number
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          emergency_surcharge?: number
          id?: string
          minimum_price?: number
          name?: string
          night_surcharge?: number
          price_per_km?: number
          service_type?: Database["public"]["Enums"]["mission_category"]
          updated_at?: string
          weekend_surcharge?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          is_demo: boolean
          last_name: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean
          is_demo?: boolean
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          administrator_id: string | null
          amount: number
          created_at: string
          id: string
          mission_id: string | null
          payment_id: string
          reason: string | null
        }
        Insert: {
          administrator_id?: string | null
          amount: number
          created_at?: string
          id?: string
          mission_id?: string | null
          payment_id: string
          reason?: string | null
        }
        Update: {
          administrator_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          mission_id?: string | null
          payment_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          client_id: string
          comment: string | null
          communication: number | null
          created_at: string
          id: string
          is_demo: boolean
          mission_id: string
          operator_id: string | null
          professionalism: number | null
          punctuality: number | null
          quality: number | null
          rating: number
          speed: number | null
        }
        Insert: {
          client_id: string
          comment?: string | null
          communication?: number | null
          created_at?: string
          id?: string
          is_demo?: boolean
          mission_id: string
          operator_id?: string | null
          professionalism?: number | null
          punctuality?: number | null
          quality?: number | null
          rating: number
          speed?: number | null
        }
        Update: {
          client_id?: string
          comment?: string | null
          communication?: number | null
          created_at?: string
          id?: string
          is_demo?: boolean
          mission_id?: string
          operator_id?: string | null
          professionalism?: number | null
          punctuality?: number | null
          quality?: number | null
          rating?: number
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: true
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          company_id: string | null
          created_at: string
          energy: string | null
          id: string
          is_demo: boolean
          model: string | null
          notes: string | null
          owner_id: string | null
          plate: string | null
          updated_at: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          energy?: string | null
          id?: string
          is_demo?: boolean
          model?: string | null
          notes?: string | null
          owner_id?: string | null
          plate?: string | null
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          energy?: string | null
          id?: string
          is_demo?: boolean
          model?: string | null
          notes?: string | null
          owner_id?: string | null
          plate?: string | null
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_operator_id: { Args: { _user_id: string }; Returns: string }
      owns_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "tow_operator" | "company" | "admin"
      availability_status: "AVAILABLE" | "UNAVAILABLE" | "ON_MISSION"
      mission_category:
        | "PANNE"
        | "REMORQUAGE"
        | "BATTERIE"
        | "CREVAISON"
        | "ERREUR_CARBURANT"
        | "ACCIDENT"
        | "VEHICULE_ELECTRIQUE"
        | "AUTRE"
        | "CLES_ENFERMEES"
        | "FUMEE_DANGER"
      mission_priority: "NORMAL" | "HIGH" | "EMERGENCY"
      mission_status:
        | "CREATED"
        | "AI_ANALYSIS"
        | "SEARCHING"
        | "PROPOSED"
        | "ACCEPTED"
        | "EN_ROUTE"
        | "ARRIVED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | "DISPUTED"
      offer_status:
        | "PENDING"
        | "ACCEPTED"
        | "DECLINED"
        | "EXPIRED"
        | "CANCELLED"
      payment_status:
        | "PENDING"
        | "PROCESSING"
        | "PAID"
        | "FAILED"
        | "REFUNDED"
        | "CANCELLED"
      verification_status: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["customer", "tow_operator", "company", "admin"],
      availability_status: ["AVAILABLE", "UNAVAILABLE", "ON_MISSION"],
      mission_category: [
        "PANNE",
        "REMORQUAGE",
        "BATTERIE",
        "CREVAISON",
        "ERREUR_CARBURANT",
        "ACCIDENT",
        "VEHICULE_ELECTRIQUE",
        "AUTRE",
        "CLES_ENFERMEES",
        "FUMEE_DANGER",
      ],
      mission_priority: ["NORMAL", "HIGH", "EMERGENCY"],
      mission_status: [
        "CREATED",
        "AI_ANALYSIS",
        "SEARCHING",
        "PROPOSED",
        "ACCEPTED",
        "EN_ROUTE",
        "ARRIVED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
      ],
      offer_status: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"],
      payment_status: [
        "PENDING",
        "PROCESSING",
        "PAID",
        "FAILED",
        "REFUNDED",
        "CANCELLED",
      ],
      verification_status: ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"],
    },
  },
} as const
