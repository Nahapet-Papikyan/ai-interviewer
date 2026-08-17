import type { MessageRole } from "@prisma/client";

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
  return role;
}

export function InterviewChat({ messages, respondentName }: Props) {
  if (messages.length === 0) {
    return (
      <div id="transcript" className="card">
        <h2 className="font-medium">Conversation</h2>
        <p className="mt-3 text-sm text-zinc-500">No transcript yet for this interview.</p>
      </div>
    );
  }

  return (
    <section id="transcript" className="card flex min-h-0 flex-col p-0">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="font-medium">Conversation</h2>
        <p className="text-xs text-zinc-500">{messages.length} turns</p>
      </div>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const isAssistant = message.role === "assistant";
          return (
            <div
              key={message.id}
              id={`m-${message.sequenceNo}`}
              className={`scroll-mt-24 rounded-xl px-1 py-1 target:bg-amber-50 ${
                isUser ? "flex justify-end" : "flex justify-start"
              }`}
            >
              <div className={`max-w-[92%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div className="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  <span>{roleLabel(message.role, respondentName)}</span>
                  <span>#{message.sequenceNo}</span>
                </div>
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-6 ${
                    isUser
                      ? "rounded-br-md bg-zinc-900 text-white"
                      : isAssistant
                        ? "rounded-bl-md bg-zinc-100 text-zinc-900"
                        : "rounded-bl-md border border-zinc-200 bg-white text-zinc-600"
                  }`}
                >
                  {message.contentText}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
