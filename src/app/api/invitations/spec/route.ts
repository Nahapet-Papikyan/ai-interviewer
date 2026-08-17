import { NextRequest, NextResponse } from "next/server";
import { requireIngestApiKey } from "@/lib/ingest-auth";

export async function GET(request: NextRequest) {
  const auth = requireIngestApiKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "AI Interviewer invitations",
      version: "1.0.0",
      description:
        "Create a company, contact, and unique interview link to send by email. The plaintext link is returned once.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/invitations": {
        post: {
          operationId: "createInterviewInvitation",
          summary: "Create an interview invitation link",
          description:
            "Store company and respondent data, then return a unique interview URL to send by email.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InvitationRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Invitation created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InvitationResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        InvitationRequest: {
          type: "object",
          required: ["firstName", "role", "companyName"],
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            role: { type: "string", description: "Job title, e.g. CEO or Operations Director" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            language: { type: "string", enum: ["hy", "en", "ru"], default: "hy" },
            companyName: { type: "string" },
            legalName: { type: "string" },
            website: { type: "string" },
            vertical: { type: "string", description: "Industry, e.g. FMCG distribution" },
            employeeRange: { type: "string" },
            notes: { type: "string" },
            verifiedFacts: {
              type: "array",
              items: { type: "string" },
              description: "Known facts that the interviewer may mention",
            },
            hypotheses: {
              type: "array",
              items: { type: "string" },
              description: "Research hypotheses to probe, not treat as facts",
            },
          },
        },
        InvitationResponse: {
          type: "object",
          properties: {
            interviewUrl: { type: "string", format: "uri" },
            interviewId: { type: "string" },
            companyName: { type: "string" },
            respondentName: { type: "string" },
            language: { type: "string" },
          },
        },
      },
    },
  });
}
