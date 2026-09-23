"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownReport({ content, className }: { content: string; className?: string }) {
  return (
    <article className={cn("markdown-report text-sm leading-7 text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 border-b border-border pb-3 text-xl font-bold tracking-tight text-navy sm:text-2xl">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-6 flex items-center gap-2 text-base font-bold text-navy first:mt-0">
              <span className="h-5 w-1 rounded-full bg-gov" aria-hidden="true" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-gov">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1.5 mt-4 text-sm font-semibold text-navy">{children}</h4>
          ),
          p: ({ children }) => <p className="my-2 leading-7 text-foreground">{children}</p>,
          ul: ({ children }) => <ul className="my-3 space-y-1.5 pl-1">{children}</ul>,
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-gov [&>li]:pl-1 [&>li]:before:hidden">
              {children}
            </ol>
          ),
          li: ({ children, className: itemClassName }) => (
            <li
              className={cn(
                "relative pl-5 leading-6 text-foreground before:absolute before:left-0 before:top-[0.65rem] before:size-1.5 before:rounded-full before:bg-gov",
                itemClassName,
              )}
            >
              {children}
            </li>
          ),
          strong: ({ children }) => <strong className="font-semibold text-navy">{children}</strong>,
          em: ({ children }) => <em className="text-muted-foreground">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-r-lg border-l-4 border-warning bg-warning/10 px-4 py-2 text-navy">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-border" />,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-gov underline decoration-gov/30 underline-offset-2 hover:decoration-gov"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {children}
            </pre>
          ),
          code: ({ children, className: codeClassName }) => {
            const block = Boolean(codeClassName) || String(children).includes("\n");
            return (
              <code
                className={cn(
                  block
                    ? "font-mono text-xs text-slate-100"
                    : "rounded bg-gov/10 px-1.5 py-0.5 font-mono text-[0.85em] text-gov",
                  codeClassName,
                )}
              >
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-navy text-white">{children}</thead>,
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border bg-background">{children}</tbody>
          ),
          tr: ({ children }) => <tr className="transition-colors hover:bg-gov/5">{children}</tr>,
          th: ({ children }) => (
            <th className="border-r border-white/10 px-3 py-2.5 font-semibold last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-r border-border px-3 py-2.5 align-top leading-5 last:border-r-0">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
