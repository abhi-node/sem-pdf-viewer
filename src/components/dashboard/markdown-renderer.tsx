"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { Check, Copy } from "lucide-react";
import type { Components } from "react-markdown";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? (
        <>
          <Check className="size-3" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3" />
          Copy
        </>
      )}
    </button>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 text-lg font-bold tracking-tight text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-base font-bold tracking-tight text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-sm font-bold text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-foreground last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1.5 text-sm leading-relaxed text-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2 text-sm">{children}</td>
  ),
  hr: () => <hr className="my-4 border-border" />,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("hljs") || className?.includes("language-");

    if (isBlock) {
      const lang = className
        ?.replace("hljs ", "")
        .replace("language-", "")
        .split(" ")[0];
      const codeText =
        typeof children === "string"
          ? children
          : String(children).replace(/\n$/, "");

      return (
        <div className="group/code mb-3 overflow-hidden rounded-md border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {lang || "code"}
            </span>
            <CopyButton text={codeText} />
          </div>
          <div className="overflow-x-auto bg-muted/50 p-3">
            <code
              className={`${className || ""} block font-mono text-[13px] leading-relaxed`}
              {...props}
            >
              {children}
            </code>
          </div>
        </div>
      );
    }

    return (
      <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[13px]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
};

interface MarkdownRendererProps {
  content: string;
  onPageClick?: (page: number) => void;
}

function preprocessCitations(content: string): string {
  return content.replace(
    /\[Pages?\s+(\d+)(?:\s*-\s*\d+)?\]/g,
    (match, page) => `[${match.slice(1, -1)}](#page-${page})`,
  );
}

export function MarkdownRenderer({ content, onPageClick }: MarkdownRendererProps) {
  const mdComponents: Components = {
    ...components,
    a: ({ href, children }) => {
      if (href?.startsWith("#page-") && onPageClick) {
        const page = parseInt(href.replace("#page-", ""), 10);
        return (
          <button
            type="button"
            onClick={() => onPageClick(page)}
            className="inline-flex cursor-pointer items-center rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            {children}
          </button>
        );
      }
      return (
        <a
          href={href}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={mdComponents}
      >
        {preprocessCitations(content)}
      </ReactMarkdown>
    </div>
  );
}
