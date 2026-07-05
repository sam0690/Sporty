import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { useApiMutation } from "@/hooks/api/useApiMutation";
import {
  AdminService,
  type TAdminTicketDetail,
  type TAdminTicketListResponse,
  type TTicketMessage,
  type TTicketUpdateRequest,
} from "@/services/AdminService";

export function useAdminTickets(params?: { page?: number; pageSize?: number; status?: string }) {
  return useApiQuery<TAdminTicketListResponse>(
    ["admin", "tickets", params ?? {}],
    () => AdminService.getTickets(params),
  );
}

export function useAdminTicket(id: string) {
  return useApiQuery<TAdminTicketDetail>(
    ["admin", "tickets", id],
    () => AdminService.getTicket(id),
    { enabled: !!id },
  );
}

export function useUpdateTicket(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TAdminTicketDetail, TTicketUpdateRequest>(
    (data) => AdminService.updateTicket(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Ticket updated",
    },
  );
}

export function useAddAdminTicketMessage(id: string) {
  const queryClient = useQueryClient();
  return useApiMutation<TTicketMessage, { body: string; isInternalNote: boolean }>(
    ({ body, isInternalNote }) => AdminService.addTicketMessage(id, body, isInternalNote),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "tickets", id] });
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      },
      successMessage: "Message sent",
    },
  );
}
