import { authApi } from "@/api/auth-api-client";
import { API_PATHS } from "@/api/apiPath";

export type TTicketCategory = "account" | "league_dispute" | "transfer_dispute" | "billing" | "bug" | "other";
export type TTicketPriority = "low" | "normal" | "high" | "urgent";
export type TTicketStatus = "open" | "in_progress" | "waiting_on_user" | "resolved" | "closed";

export type TTicketMessage = {
  id: string;
  author_user_id: string;
  body: string;
  is_internal_note: boolean;
  created_at: string;
};

export type TTicket = {
  id: string;
  reporter_user_id: string;
  league_id: string | null;
  subject: string;
  category: TTicketCategory;
  priority: TTicketPriority;
  status: TTicketStatus;
  assigned_admin_user_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type TTicketDetail = TTicket & {
  messages: TTicketMessage[];
};

export type TTicketListResponse = {
  items: TTicket[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
};

export const SupportService = {
  async createTicket(data: { subject: string; category: TTicketCategory; league_id?: string; body: string }): Promise<TTicket> {
    const res = await authApi.post(API_PATHS.SUPPORT.TICKETS, data);
    return res.data;
  },

  async getMyTickets(params?: { page?: number; page_size?: number }): Promise<TTicketListResponse> {
    const res = await authApi.get(API_PATHS.SUPPORT.TICKETS, { params });
    return res.data;
  },

  async getTicket(id: string): Promise<TTicketDetail> {
    const res = await authApi.get(API_PATHS.SUPPORT.TICKET_DETAIL(id));
    return res.data;
  },

  async addMessage(id: string, body: string): Promise<TTicketMessage> {
    const res = await authApi.post(API_PATHS.SUPPORT.TICKET_MESSAGES(id), { body });
    return res.data;
  },
};
