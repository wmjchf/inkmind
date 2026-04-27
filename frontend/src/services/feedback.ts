import { apiRequest } from "./api";

export async function submitFeedback(body: { content: string; contact?: string | null }) {
  return apiRequest<{ id: number }>({
    url: "/feedback",
    method: "POST",
    data: {
      content: body.content,
      contact: body.contact ?? undefined,
    },
  });
}
