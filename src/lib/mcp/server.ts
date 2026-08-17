import { randomUUID } from "crypto";
import { invitationSchema, issueInterviewInvitation } from "@/lib/interview/invitation-api";
import { rateLimit } from "@/lib/rate-limit";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const PROTOCOL_VERSIONS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

export const CREATE_INVITATION_TOOL = {
  name: "createInterviewInvitation",
  title: "Create interview invitation",
  description:
    "Store company and respondent details, then create a unique interview URL to send by email. Required: firstName, role, companyName. Return interviewUrl to the user.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["firstName", "role", "companyName"],
    properties: {
      firstName: { type: "string", description: "Respondent given name" },
      lastName: { type: "string", description: "Respondent family name" },
      role: { type: "string", description: "Job title, e.g. CEO or Operations Director" },
      email: { type: "string", description: "Work email" },
      language: {
        type: "string",
        enum: ["hy", "en", "ru"],
        description: "Interview language. Default hy.",
      },
      companyName: { type: "string" },
      vertical: { type: "string", description: "Industry, e.g. Wholesale" },
      website: { type: "string" },
      employeeRange: { type: "string" },
      notes: { type: "string", description: "Internal research notes" },
      verifiedFacts: {
        type: "array",
        items: { type: "string" },
        description: "Known facts the interviewer may mention",
      },
      hypotheses: {
        type: "array",
        items: { type: "string" },
        description: "Research hypotheses to probe, not treat as facts",
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["interviewUrl", "companyName", "respondentName"],
    properties: {
      interviewUrl: { type: "string" },
      interviewId: { type: "string" },
      companyName: { type: "string" },
      respondentName: { type: "string" },
      language: { type: "string" },
    },
  },
  annotations: {
    title: "Create interview invitation",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
};

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id, error: { code, message, data } };
}

async function handleCall(params: Record<string, unknown> | undefined, origin?: string) {
  const name = typeof params?.name === "string" ? params.name : "";
  if (name !== CREATE_INVITATION_TOOL.name) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${name || "(missing)"}` }],
    };
  }

  if (!rateLimit("mcp:createInterviewInvitation", 40, 60 * 60 * 1000)) {
    return {
      isError: true,
      content: [{ type: "text", text: "Too many invitation requests. Try again later." }],
    };
  }

  const parsed = invitationSchema.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }],
    };
  }

  const created = await issueInterviewInvitation(parsed.data, origin);
  return {
    structuredContent: created,
    content: [
      {
        type: "text",
        text: `Interview link created for ${created.respondentName} at ${created.companyName}: ${created.interviewUrl}`,
      },
    ],
  };
}

export async function handleMcpMessage(message: JsonRpcRequest, origin?: string) {
  const id = message.id ?? null;
  const method = message.method;

  if (message.jsonrpc !== "2.0" || !method) {
    return { response: rpcError(id, -32600, "Invalid Request"), notification: false };
  }

  if (method.startsWith("notifications/")) {
    return { response: null, notification: true };
  }

  if (method === "initialize") {
    const requested =
      typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : "";
    const protocolVersion = PROTOCOL_VERSIONS.has(requested) ? requested : "2025-03-26";
    return {
      notification: false,
      sessionId: randomUUID(),
      response: rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "business-research-interviewer", version: "1.0.0" },
        instructions:
          "Create unique interview invitation links. Collect firstName, role, and companyName at minimum. Return only interviewUrl for the email. Do not ask the user for API keys.",
      }),
    };
  }

  if (method === "ping") {
    return { notification: false, response: rpcResult(id, {}) };
  }

  if (method === "tools/list") {
    return {
      notification: false,
      response: rpcResult(id, { tools: [CREATE_INVITATION_TOOL] }),
    };
  }

  if (method === "tools/call") {
    try {
      const result = await handleCall(message.params, origin);
      return { notification: false, response: rpcResult(id, result) };
    } catch (error) {
      return {
        notification: false,
        response: rpcResult(id, {
          isError: true,
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "Invitation failed",
            },
          ],
        }),
      };
    }
  }

  return { notification: false, response: rpcError(id, -32601, `Method not found: ${method}`) };
}
