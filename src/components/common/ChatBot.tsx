import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  FileUp,
  Loader2,
  Maximize2,
  Minimize2,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThinkingDots } from "@/components/common/ThinkingDots";
import {
  answerQuestion,
  createDraftDataset,
  extractFromFile,
  readReportDatasets,
  summarizeDataset,
  writeReportDatasets,
} from "@/lib/report-service";
import { answerDataQuestion, CHAT_SUGGESTIONS, helpAnswer } from "@/lib/chat-qa";
import type { ReportDataset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatAction {
  label: string;
  to: string;
}

interface AnswerRow {
  label: string;
  value: string;
  tone?: string;
}

interface ChatMsg {
  id: number;
  from: "bot" | "user";
  text: string;
  action?: ChatAction;
  rows?: AnswerRow[];
  followUps?: string[];
}

const WELCOME: ChatMsg = {
  id: 0,
  from: "bot",
  text: "Xin chào! Tôi là trợ lý ảo ngành Công Thương Tây Ninh. Tôi có thể trả lời câu hỏi về dữ liệu trong nền tảng: doanh nghiệp, cụm công nghiệp, năng lượng, xuất nhập khẩu, xúc tiến thương mại, lãnh đạo, tin tức — và nhận file dữ liệu (CSV/Excel/Word/PDF) để trích xuất thành báo cáo chuẩn hóa. Bạn có thể đặt câu hỏi hoặc chọn gợi ý bên dưới:",
  followUps: CHAT_SUGGESTIONS,
};

const ACCEPT = ".csv,.txt,.xlsx,.xls,.docx,.doc,.pdf";

const THINK_LABELS = [
  "Đang phân tích câu hỏi",
  "Đang truy xuất CSDL ngành Công Thương",
  "Đang tổng hợp câu trả lời",
] as const;

const FILE_LABELS = ["Đang đọc file", "Đang trích xuất dữ liệu", "Đang chuẩn hóa báo cáo"] as const;

// Trả lời dựa trên dữ liệu báo cáo đã lưu trong CSDL (JSON/localStorage).
function reportBotAnswer(question: string): ChatMsg | undefined {
  const q = question.toLowerCase();
  const isReportQuestion =
    q.includes("báo cáo") ||
    q.includes("báo cao") ||
    q.includes("xuất nhập khẩu") ||
    q.includes("xếp hạng") ||
    q.includes("tăng") ||
    q.includes("giảm") ||
    q.includes("quốc gia") ||
    q.includes("so sánh") ||
    q.includes("kỳ");
  if (!isReportQuestion) return undefined;

  const datasets = readReportDatasets();
  const approved = datasets
    .filter((d) => d.status === "approved" || d.status === "locked")
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const draft = datasets.filter((d) => d.status === "draft");
  const dataset: ReportDataset | undefined = approved[0];

  if (q.includes("nháp") || q.includes("chờ") || q.includes("chua duyệt")) {
    if (!draft.length) return undefined;
    const names = draft.map((d) => `"${d.name}"`).join(", ");
    return {
      id: Date.now() + 1,
      from: "bot",
      text: `Hiện có ${draft.length} báo cáo nháp chờ xử lý: ${names}. Bạn vào trang Báo cáo & BI để kiểm tra, chuẩn hóa và xác nhận.`,
      action: { label: "Xử lý nháp → Báo cáo & BI", to: "/analytics" },
      followUps: ["Có bao nhiêu doanh nghiệp?", "Tổng kim ngạch XNK 6T/2026?"],
    };
  }

  if (!dataset) {
    if (q.includes("báo cáo") || q.includes("báo cao")) {
      return {
        id: Date.now() + 1,
        from: "bot",
        text: "Chưa có báo cáo nào được lưu. Bạn có thể upload file dữ liệu (CSV/Excel/Word/PDF) ngay tại đây bằng nút đính kèm 📎 để tôi trích xuất thành báo cáo chuẩn hóa.",
        followUps: ["Có bao nhiêu doanh nghiệp?", "Độ tin cậy cung cấp điện?"],
      };
    }
    return undefined;
  }

  const answer = answerQuestion(dataset, question);
  const rows: AnswerRow[] | undefined = answer.rows
    ?.map((r) => {
      const tone =
        r.tone === "up" ? "text-success" : r.tone === "down" ? "text-destructive" : undefined;
      return tone
        ? { label: r.label, value: String(r.value), tone }
        : { label: r.label, value: String(r.value) };
    })
    .filter((r): r is AnswerRow => true);
  const msg: ChatMsg = {
    id: Date.now() + 1,
    from: "bot",
    text: `Báo cáo gần nhất: "${dataset.name}" (${dataset.period}). ${answer.text}`,
    action: { label: "Xem Dashboard & xuất báo cáo → /analytics", to: "/analytics" },
    followUps: ["So sánh kỳ trước?", "Quốc gia nào tăng mạnh nhất?", "Xem Dashboard báo cáo"],
  };
  return rows?.length ? { ...msg, rows } : msg;
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState<string>(THINK_LABELS[0]);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [messages, open, typing]);

  const pushBot = (msg: Omit<ChatMsg, "id" | "from">) => {
    setMessages((m) => [...m, { ...msg, id: Date.now() + 1, from: "bot" }]);
    setTyping(false);
  };

  const send = (preset?: string) => {
    const text = (preset?.trim() || input.trim()) as string;
    if (!text || typing) return;
    setMessages((m) => [...m, { id: Date.now(), from: "user", text }]);
    setInput("");
    setTyping(true);
    setThinkingLabel(THINK_LABELS[0]);
    const dataAnswer = answerDataQuestion(text);
    const reply: ChatMsg =
      reportBotAnswer(text) ??
      ({
        id: Date.now() + 1,
        from: "bot",
        ...(dataAnswer ?? helpAnswer()),
      } as ChatMsg);
    THINK_LABELS.forEach((label, i) => {
      if (i === 0) return;
      setTimeout(() => setThinkingLabel(label), i * 1000);
    });
    setTimeout(() => pushBot(reply), 3000 + Math.random() * 1000);
  };

  const handleFile = (file: File) => {
    if (!file || typing) return;
    setMessages((m) => [...m, { id: Date.now(), from: "user", text: `📎 ${file.name}` }]);
    setTyping(true);
    setThinkingLabel(FILE_LABELS[0]);
    FILE_LABELS.forEach((label, i) => {
      if (i === 0) return;
      setTimeout(() => setThinkingLabel(label), i * 1000);
    });
    Promise.all([extractFromFile(file), new Promise<void>((resolve) => setTimeout(resolve, 2800))])
      .then(([extracted]) => {
        const draft = createDraftDataset({
          name: extracted.name,
          fileName: file.name,
          fileType: extracted.fileType,
          columns: extracted.columns,
          rows: extracted.rows,
          period: "Chưa cập nhật",
          year: new Date().getFullYear(),
          source: "ChatBot",
          via: "chatbot",
        });
        writeReportDatasets([draft, ...readReportDatasets()]);
        toast.success(
          `Đã trích xuất "${file.name}": ${extracted.rows.length} dòng · ${extracted.columns.length} cột.`,
        );
        pushBot({
          text: `Đã nhận file "${file.name}". Tôi đã trích xuất ${extracted.rows.length} dòng · ${extracted.columns.length} cột và chuẩn hóa thành báo cáo nháp "${draft.name}".\n\n${summarizeDataset(draft)}\n\nHãy kiểm tra dữ liệu, xác nhận rồi xuất báo cáo Word/Excel/PDF trên trang Báo cáo & BI.`,
          action: { label: "Xem & xuất báo cáo → /analytics", to: "/analytics" },
        });
      })
      .catch((err: Error) => {
        toast.error(`Không trích xuất được file: ${err.message ?? "lỗi không xác định"}.`);
        pushBot({
          text: `Xin lỗi, không trích xuất được file: ${err.message ?? "lỗi không xác định"}.`,
        });
      });
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel",
            maximized
              ? "fixed bottom-0 right-0 top-0 z-50 h-screen w-screen rounded-none sm:bottom-4 sm:right-4 sm:top-auto sm:h-[calc(100vh-2rem)] sm:w-[min(40rem,calc(100vw-2rem))] sm:rounded-2xl"
              : "h-[32rem] max-h-[calc(100vh-2rem)] w-[calc(100vw-2.5rem)] max-w-sm",
          )}
        >
          <div className="flex items-center gap-2.5 bg-navy px-4 py-3 text-navy-foreground">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
              <img src="/img/chatBotRobot.png" alt="ChatBot" className="size-5 object-contain" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold">Trợ lý ảo ngành Công Thương</p>
              <p className="flex items-center gap-1.5 text-[11px] text-white/70">
                <span className="size-1.5 rounded-full bg-success" />
                Đang trực tuyến · AI
              </p>
            </div>
            <Sparkles className="size-4 text-warning" />
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-white hover:bg-white/10"
              onClick={() => setMaximized((m) => !m)}
              title={maximized ? "Thu nhỏ" : "Phóng to"}
            >
              {maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-white hover:bg-white/10"
              onClick={() => {
                setOpen(false);
                setMaximized(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-background p-3.5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    m.from === "user"
                      ? "rounded-br-sm bg-gov text-white"
                      : "rounded-bl-sm border border-border bg-card text-foreground",
                  )}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.rows?.length ? (
                    <ul className="mt-2 space-y-1 border-t border-border pt-2">
                      {m.rows.map((r) => (
                        <li
                          key={r.label}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {r.label}
                          </span>
                          <span className={cn("font-medium tabular-nums", r.tone)}>{r.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {m.action ? (
                    <Link
                      to={m.action.to}
                      onClick={() => {
                        setOpen(false);
                        setMaximized(false);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gov/10 px-2.5 py-1.5 text-xs font-semibold text-gov hover:bg-gov/15"
                    >
                      <FileUp className="size-3.5" />
                      {m.action.label}
                    </Link>
                  ) : null}
                  {m.followUps?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                      {m.followUps.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            if (typing) return;
                            send(f);
                          }}
                          className="rounded-full border border-border bg-surface px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-gov/50 hover:text-gov"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {typing ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{thinkingLabel}...</span>
                  <ThinkingDots />
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-border bg-card p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Nhập câu hỏi hoặc đính kèm file dữ liệu..."
              className="min-h-9 max-h-24 flex-1 resize-none bg-surface py-2"
              rows={1}
              disabled={typing}
            />
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-lg"
              title="Đính kèm file dữ liệu (CSV/Excel/Word/PDF)"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-9 shrink-0 rounded-lg bg-gov text-white hover:bg-gov/90"
              onClick={() => send()}
              disabled={!input.trim() || typing}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((o) => !o)}
        className="chatbot-btn group relative flex size-14 items-center justify-center rounded-full bg-gov text-white shadow-panel transition-colors hover:bg-gov/90"
        aria-label="Mở trợ lý ảo"
      >
        <img
          src="/img/chatBotRobot.png"
          alt=""
          aria-hidden="true"
          className="size-11 object-contain transition-transform group-hover:scale-110"
        />
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-white">
          1
        </span>
      </button>
    </div>
  );
}
