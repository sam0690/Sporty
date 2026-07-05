import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  SupportService,
  type TTicket,
  type TTicketCategory,
  type TTicketDetail,
  type TTicketListResponse,
  type TTicketMessage,
} from "@/services/SupportService";

export function useMyTickets(params?: { page?: number; page_size?: number }) {
  return useApiQuery<TTicketListResponse>(
    ["support", "tickets", params ?? {}],
    () => SupportService.getMyTickets(params),
  );
}

export function useTicket(id: string) {
  return useApiQuery<TTicketDetail>(
    ["support", "tickets", id],
    () => SupportService.getTicket(id),
    { enabled: !!id },
  );
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useApiMutation<TTicket, { subject: string; category: TTicketCategory; league_id?: string; body: string }>(
    (data) => SupportService.createTicket(data),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support", "tickets"] }),
      successMessage: "Ticket created",
    },
  );
}

export function useAddTicketMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TTicketMessage, string>(
    (body) => SupportService.addMessage(ticketId, body),
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support", "tickets", ticketId] }),
      successMessage: "Message sent",
    },
  );
}
