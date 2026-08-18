import type { MessageRole } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared";

type Message = {
  id: string;
  sequenceNo: number;
  role: MessageRole;
  contentText: string;
};

type Props = {
  messages: Message[];
  respondentName: string;
};

function roleLabel(role: MessageRole, respondentName: string) {
  if (role === "user") return respondentName;
  if (role === "assistant") return "Interviewer";
  if (role === "system") return "System";
  return role;
}

export function InterviewChat({ messages, respondentName }: Props) {
  if (messages.length === 0) {
    return (
      <Card id="transcript" className="scroll-mt-24 py-5 ring-foreground/8">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No transcript yet for this interview.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="transcript" className="flex min-h-0 scroll-mt-24 flex-col gap-0 overflow-hidden py-0 ring-foreground/8">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Conversation</h2>
          <p className="text-[11px] text-zinc-400">{messages.length} turns</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" /> Interviewer
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink" /> {respondentName}
          </span>
        </div>
      </div>
      <div className="max-h-[min(78vh,840px)] space-y-4 overflow-y-auto bg-[#f7f9fc] px-4 py-5 sm:px-6">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const isAssistant = message.role === "assistant";
          return (
            <div
              key={message.id}
              id={`m-${message.sequenceNo}`}
              className={`scroll-mt-28 rounded-2xl ${isUser ? "flex justify-end" : "flex justify-start"} target:ring-2 target:ring-brand/30`}
            >
              <div className={`w-full max-w-2xl ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
                <div className="flex items-center gap-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                  <span>{roleLabel(message.role, respondentName)}</span>
                  <span className="tabular-nums text-zinc-300">#{message.sequenceNo}</span>
                </div>
                <div
                  className={`whitespace-pre-wrap px-3.5 py-2.5 text-[14.5px] leading-6 shadow-[0_1px_2px_rgb(7_10_18_/_0.04)] ${
                    isUser
                      ? "rounded-2xl rounded-br-md bg-ink text-white"
                      : isAssistant
                        ? "rounded-2xl rounded-bl-md border border-zinc-200/70 bg-white text-zinc-900"
                        : "rounded-2xl border border-dashed border-zinc-200 bg-white text-zinc-500"
                  }`}
                >
                  {message.contentText}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
