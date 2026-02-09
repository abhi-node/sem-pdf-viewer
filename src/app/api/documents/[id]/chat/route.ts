import { headers } from "next/headers";
import { eq, and, desc, lte, gte } from "drizzle-orm";
import { cosineDistance, sql } from "drizzle-orm";
import {
  embed,
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { conversation, message, documentChunk } from "@/db/schema";

function buildSystemPrompt(currentPage?: number) {
  return `You are a helpful assistant for a PDF document. You have tools to search the document.
${currentPage ? `\nThe user is currently viewing page ${currentPage} of the document.\n` : ""}
WORKFLOW:
1. When a user asks a question, use your tools to find relevant information
2. Use semanticSearch for topic-based queries
3. Use pageSearch when you need content from a specific page
4. You may call tools multiple times to gather enough information
5. After gathering information, provide a comprehensive answer

RULES:
- Always cite sources using [Pages X-Y] format inline when referencing information
- If the user attaches an image selection from the PDF, analyze what's shown in the image
- If you can't find the answer after searching, say so
- List sources at the end under a "Sources:" heading
- When writing dollar amounts or literal dollar signs, always escape them with a backslash (e.g., write \\$100, not $100). Only use unescaped $...$ for LaTeX math expressions.`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: documentId } = await params;
  const body = await request.json();
  const { messages, conversationId, currentPage } = body as {
    messages: UIMessage[];
    conversationId: string;
    currentPage?: number;
  };

  if (!conversationId || !messages?.length) {
    return new Response("Bad request", { status: 400 });
  }

  // Verify conversation ownership
  const [conv] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        eq(conversation.userId, session.user.id),
        eq(conversation.documentId, documentId),
      ),
    );

  if (!conv) {
    return new Response("Conversation not found", { status: 404 });
  }

  // Get the last user message text
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return new Response("No user message", { status: 400 });
  }
  const lastUserText =
    lastUserMsg.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ") ||
    (lastUserMsg as unknown as { content?: string }).content ||
    "";

  // Save user message to DB
  await db.insert(message).values({
    id: crypto.randomUUID(),
    conversationId,
    role: "user",
    content: lastUserText,
    createdAt: new Date(),
  });

  // Auto-title: if first message, update conversation title
  const existingMessages = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .limit(2);

  if (existingMessages.length === 1) {
    const title = lastUserText.slice(0, 80);
    await db
      .update(conversation)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversation.id, conversationId));
  }

  // Define tools — closed over documentId
  const pageSearch = tool({
    description:
      "Search for document content by page number. Use this when you need to read a specific page or section of the PDF.",
    inputSchema: z.object({
      page: z.number().int().describe("The page number to retrieve content from"),
    }),
    execute: async ({ page }) => {
      const chunks = await db
        .select({
          content: documentChunk.content,
          startPage: documentChunk.startPage,
          endPage: documentChunk.endPage,
        })
        .from(documentChunk)
        .where(
          and(
            eq(documentChunk.documentId, documentId),
            lte(documentChunk.startPage, page),
            gte(documentChunk.endPage, page),
          ),
        );

      if (chunks.length === 0) {
        return { error: "Page not in range — no content found for this page number." };
      }

      return {
        results: chunks.map((c) => ({
          content: c.content,
          startPage: c.startPage,
          endPage: c.endPage,
        })),
      };
    },
  });

  const semanticSearch = tool({
    description:
      "Search the document using a semantic query. Use this when you need to find information about a specific topic but don't know which page it's on.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("A descriptive search query to find relevant document sections"),
    }),
    execute: async ({ query }) => {
      const { embedding } = await embed({
        model: google.embedding("gemini-embedding-001"),
        value: query,
        providerOptions: {
          google: { outputDimensionality: 768 },
        },
      });

      const similarity = sql<number>`1 - (${cosineDistance(documentChunk.embedding, embedding)})`;
      const chunks = await db
        .select({
          content: documentChunk.content,
          startPage: documentChunk.startPage,
          endPage: documentChunk.endPage,
        })
        .from(documentChunk)
        .where(eq(documentChunk.documentId, documentId))
        .orderBy(desc(similarity))
        .limit(3);

      if (chunks.length === 0) {
        return { error: "No content found for this query." };
      }

      return {
        results: chunks.map((c) => ({
          content: c.content,
          startPage: c.startPage,
          endPage: c.endPage,
        })),
      };
    },
  });

  // Stream response with tools
  const result = streamText({
    model: google("gemini-3-flash-preview"),
    system: buildSystemPrompt(currentPage),
    messages: await convertToModelMessages(messages),
    tools: { pageSearch, semanticSearch },
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, steps }) => {
      // Build parts array from steps for DB storage
      const parts: unknown[] = [];
      for (const step of steps) {
        for (const tc of step.toolCalls) {
          parts.push({
            type: `tool-${tc.toolName}`,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            state: "output-available",
            input: tc.input,
          });
        }
      }
      parts.push({ type: "text", text });

      await db.insert(message).values({
        id: crypto.randomUUID(),
        conversationId,
        role: "assistant",
        content: text,
        parts: JSON.stringify(parts),
        createdAt: new Date(),
      });
      await db
        .update(conversation)
        .set({ updatedAt: new Date() })
        .where(eq(conversation.id, conversationId));
    },
  });

  return result.toUIMessageStreamResponse();
}
