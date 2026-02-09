"use server";

import { headers } from "next/headers";
import { eq, and, desc, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { document, conversation, message } from "@/db/schema";

async function getUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new Error("Unauthorized");
  return session.user;
}

export async function listConversations(documentId: string) {
  const user = await getUser();

  return db
    .select({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    })
    .from(conversation)
    .where(
      and(
        eq(conversation.documentId, documentId),
        eq(conversation.userId, user.id),
      ),
    )
    .orderBy(desc(conversation.updatedAt));
}

export async function createConversation(documentId: string) {
  const user = await getUser();

  const [doc] = await db
    .select({ ingestionStatus: document.ingestionStatus })
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.userId, user.id)));

  if (!doc) throw new Error("Not found");
  if (doc.ingestionStatus !== "ready") throw new Error("Document is not ready");

  const now = new Date();
  const [created] = await db
    .insert(conversation)
    .values({
      id: crypto.randomUUID(),
      documentId,
      userId: user.id,
      title: "New conversation",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function loadConversationMessages(
  documentId: string,
  conversationId: string,
) {
  const user = await getUser();

  const [conv] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        eq(conversation.userId, user.id),
        eq(conversation.documentId, documentId),
      ),
    );

  if (!conv) throw new Error("Not found");

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(asc(message.createdAt));

  return { ...conv, messages };
}

export async function deleteConversation(
  documentId: string,
  conversationId: string,
) {
  const user = await getUser();

  const [deleted] = await db
    .delete(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        eq(conversation.userId, user.id),
        eq(conversation.documentId, documentId),
      ),
    )
    .returning();

  if (!deleted) throw new Error("Not found");
  return { success: true };
}
