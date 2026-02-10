import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { document, documentChunk } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { generateText, embedMany } from "ai";
import { google } from "@ai-sdk/google";
import pLimit from "p-limit";
const PAGES_PER_GROUP = 5;
const CONCURRENCY = 20;
const EMBEDDING_BATCH_SIZE = 100;

async function withCyclicRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 10,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      const delay = Math.pow(2, (attempt % 2) + 1) * 1000;
      console.log(
        `[retry] attempt ${attempt + 1} failed, waiting ${delay / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

export const ingestDocument = inngest.createFunction(
  {
    id: "ingest-document",
    retries: 3,
    concurrency: { limit: 5 },
    onFailure: async ({ event }) => {
      const documentId = event.data.event.data.documentId as string;
      await db
        .update(document)
        .set({ ingestionStatus: "failed", updatedAt: new Date() })
        .where(eq(document.id, documentId));
    },
  },
  { event: "document/uploaded" },
  async ({ event, step }) => {
    const { documentId, userId, blobUrl } = event.data as {
      documentId: string;
      userId: string;
      blobUrl: string;
    };

    // Step 1: Convert PDF to images and extract markdown in a streaming pipeline.
    // Pages stream from pdf-to-img directly into grouped Gemini calls — zero disk I/O.
    const pageInfo = await step.run("extract-pages", async () => {
      const stepStart = Date.now();

      await db
        .update(document)
        .set({ ingestionStatus: "extracting", updatedAt: new Date() })
        .where(eq(document.id, documentId));

      const pdfInitStart = Date.now();
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new NonRetriableError(`Failed to fetch PDF from blob storage`);
      }
      const pdfBuffer = Buffer.from(await response.arrayBuffer());

      const { pdf } = await import("pdf-to-img");
      const doc = await pdf(pdfBuffer, { scale: 1.5 });
      const pdfInitMs = Date.now() - pdfInitStart;
      console.log(
        `[extract] pdf init: ${pdfInitMs}ms, total pages: ${doc.length}`,
      );

      if (doc.length === 0) {
        throw new NonRetriableError("PDF has no pages");
      }

      const limit = pLimit(CONCURRENCY);
      const groupTimings: Array<{
        groupIndex: number;
        pages: number;
        payloadKB: number;
        geminiMs: number;
        dbInsertMs: number;
        contentLength: number;
      }> = [];

      const tasks: Promise<void>[] = [];

      let currentGroup: Buffer[] = [];
      let pageNum = 0;
      let groupIndex = 0;
      const totalGroups = Math.ceil(doc.length / PAGES_PER_GROUP);

      const iterStart = Date.now();

      for await (const image of doc) {
        currentGroup.push(image);
        pageNum++;

        if (currentGroup.length === PAGES_PER_GROUP || pageNum === doc.length) {
          const groupImages = currentGroup;
          const gIdx = groupIndex;
          const startPage = gIdx * PAGES_PER_GROUP;
          const endPage = startPage + groupImages.length;

          tasks.push(
            limit(async () => {
              const payloadBytes = groupImages.reduce(
                (sum, buf) => sum + buf.byteLength,
                0,
              );

              const geminiStart = Date.now();
              const { text } = await withCyclicRetry(() =>
                generateText({
                  model: google("gemini-3-flash-preview"),
                  maxRetries: 0,
                  providerOptions: {
                    google: { thinkingConfig: { thinkingBudget: 0 } },
                  },
                  messages: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "Convert these PDF pages to structured Markdown. Preserve all headings, paragraphs, lists, tables, code blocks, and equations. Return only the Markdown content.",
                        },
                        ...groupImages.map((buf) => ({
                          type: "image" as const,
                          image: buf,
                          mimeType: "image/png" as const,
                        })),
                      ],
                    },
                  ],
                }),
              );
              const geminiMs = Date.now() - geminiStart;

              if (text.trim().length === 0) {
                const timing = {
                  groupIndex: gIdx,
                  pages: groupImages.length,
                  payloadKB: Math.round(payloadBytes / 1024),
                  geminiMs,
                  dbInsertMs: 0,
                  contentLength: 0,
                };
                groupTimings.push(timing);
                console.log(
                  `[extract] group ${gIdx + 1}/${totalGroups} done (empty) — gemini: ${geminiMs}ms, payload: ${timing.payloadKB}KB`,
                );
                return;
              }

              const dbStart = Date.now();
              await db
                .insert(documentChunk)
                .values({
                  id: `${documentId}-chunk-${gIdx}`,
                  documentId,
                  userId,
                  content: text,
                  startPage: startPage + 1,
                  endPage,
                  chunkIndex: gIdx,
                  tokenCount: text.length,
                  createdAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: documentChunk.id,
                  set: {
                    content: sql`excluded.content`,
                    tokenCount: sql`excluded.token_count`,
                  },
                });
              const dbInsertMs = Date.now() - dbStart;

              const timing = {
                groupIndex: gIdx,
                pages: groupImages.length,
                payloadKB: Math.round(payloadBytes / 1024),
                geminiMs,
                dbInsertMs,
                contentLength: text.length,
              };
              groupTimings.push(timing);
              console.log(
                `[extract] group ${gIdx + 1}/${totalGroups} done — gemini: ${geminiMs}ms, db: ${dbInsertMs}ms, payload: ${timing.payloadKB}KB, content: ${text.length} chars`,
              );
            }),
          );

          currentGroup = [];
          groupIndex++;
        }
      }

      const pageIterationMs = Date.now() - iterStart;

      await Promise.all(tasks);

      const totalExtractMs = Date.now() - stepStart;
      groupTimings.sort((a, b) => a.groupIndex - b.groupIndex);

      console.log(
        `[extract] complete — ${pageNum} pages, ${totalGroups} groups, total: ${totalExtractMs}ms`,
      );

      return {
        pageCount: pageNum,
        totalGroups,
        pdfInitMs,
        pageIterationMs,
        groupTimings,
        totalExtractMs,
      };
    });

    // Step 2: Generate embeddings for chunks missing them
    await step.run("generate-embeddings", async () => {
      const stepStart = Date.now();

      await db
        .update(document)
        .set({ ingestionStatus: "embedding", updatedAt: new Date() })
        .where(eq(document.id, documentId));

      const dbQueryStart = Date.now();
      const chunks = await db
        .select()
        .from(documentChunk)
        .where(
          and(
            eq(documentChunk.documentId, documentId),
            isNull(documentChunk.embedding),
          ),
        )
        .orderBy(documentChunk.chunkIndex);
      const dbQueryMs = Date.now() - dbQueryStart;

      const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE);
      const batchTimings: Array<{
        batchIndex: number;
        chunks: number;
        embedApiMs: number;
        dbUpdateMs: number;
      }> = [];

      console.log(
        `[embed] ${chunks.length} chunks to embed in ${totalBatches} batches (query: ${dbQueryMs}ms)`,
      );

      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const batchIndex = Math.floor(i / EMBEDDING_BATCH_SIZE);

        const apiStart = Date.now();
        const { embeddings } = await withCyclicRetry(() =>
          embedMany({
            model: google.embedding("gemini-embedding-001"),
            maxRetries: 0,
            values: batch.map((c) => c.content),
            providerOptions: {
              google: { outputDimensionality: 768 },
            },
          }),
        );
        const embedApiMs = Date.now() - apiStart;

        const dbStart = Date.now();
        await Promise.all(
          batch.map((chunk, j) =>
            db
              .update(documentChunk)
              .set({ embedding: embeddings[j] })
              .where(eq(documentChunk.id, chunk.id)),
          ),
        );
        const dbUpdateMs = Date.now() - dbStart;

        batchTimings.push({
          batchIndex,
          chunks: batch.length,
          embedApiMs,
          dbUpdateMs,
        });
        console.log(
          `[embed] batch ${batchIndex + 1}/${totalBatches} done — api: ${embedApiMs}ms, db: ${dbUpdateMs}ms, chunks: ${batch.length}`,
        );
      }

      const totalEmbedMs = Date.now() - stepStart;
      console.log(
        `[embed] complete — ${chunks.length} chunks, total: ${totalEmbedMs}ms`,
      );

      return {
        totalChunks: chunks.length,
        totalBatches,
        dbQueryMs,
        batchTimings,
        totalEmbedMs,
      };
    });

    // Step 3: Mark document as ready
    await step.run("mark-ready", async () => {
      await db
        .update(document)
        .set({ ingestionStatus: "ready", updatedAt: new Date() })
        .where(eq(document.id, documentId));
    });

    return { documentId };
  },
);
