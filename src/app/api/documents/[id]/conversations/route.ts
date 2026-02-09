import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { document, conversation } from "@/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conversations = await db
    .select({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    })
    .from(conversation)
    .where(
      and(
        eq(conversation.documentId, id),
        eq(conversation.userId, session.user.id),
      ),
    )
    .orderBy(desc(conversation.updatedAt));

  return NextResponse.json(conversations);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [doc] = await db
    .select({ ingestionStatus: document.ingestionStatus })
    .from(document)
    .where(and(eq(document.id, id), eq(document.userId, session.user.id)));

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.ingestionStatus !== "ready") {
    return NextResponse.json(
      { error: "Document is not ready" },
      { status: 400 },
    );
  }

  const now = new Date();
  const newConversation = {
    id: crypto.randomUUID(),
    documentId: id,
    userId: session.user.id,
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
  };

  const [created] = await db
    .insert(conversation)
    .values(newConversation)
    .returning();

  return NextResponse.json(created, { status: 201 });
}
