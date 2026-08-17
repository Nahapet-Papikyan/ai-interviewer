import { NextRequest, NextResponse } from "next/server";
import { handleMcpMessage } from "@/lib/mcp/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
};

function withCors(response: NextResponse) {
  for (const [key, value] of Object.entries(CORS)) {
    response.headers.set(key, value);
  }
  return response;
}

function jsonRpcResponse(body: unknown, sessionId?: string) {
  const response = NextResponse.json(body);
  if (sessionId) response.headers.set("Mcp-Session-Id", sessionId);
  response.headers.set("MCP-Protocol-Version", "2025-03-26");
  return withCors(response);
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  const response = new NextResponse(": connected\n\n", {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
  return withCors(response);
}

export async function DELETE() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const incomingSession = request.headers.get("mcp-session-id") ?? undefined;
  const payload = await request.json().catch(() => null);

  if (Array.isArray(payload)) {
    const results = [];
    let sessionId = incomingSession;
    for (const item of payload) {
      const handled = await handleMcpMessage(item, origin);
      if (handled.sessionId) sessionId = handled.sessionId;
      if (handled.response) results.push(handled.response);
    }
    if (results.length === 0) return withCors(new NextResponse(null, { status: 202 }));
    return jsonRpcResponse(results, sessionId);
  }

  if (!payload || typeof payload !== "object") {
    return jsonRpcResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      incomingSession,
    );
  }

  const handled = await handleMcpMessage(payload, origin);
  const sessionId = handled.sessionId ?? incomingSession;
  if (handled.notification || !handled.response) {
    const response = new NextResponse(null, { status: 202 });
    if (sessionId) response.headers.set("Mcp-Session-Id", sessionId);
    return withCors(response);
  }
  return jsonRpcResponse(handled.response, sessionId);
}
