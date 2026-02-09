import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { conversation, message } from "@/db/schema";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; conversationId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  const [conv] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        eq(conversation.userId, session.user.id),
      ),
    );

  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(asc(message.createdAt));

  return NextResponse.json({ ...conv, messages });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; conversationId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  const [deleted] = await db
    .delete(conversation)
    .where(
      and(
        eq(conversation.id, conversationId),
        eq(conversation.userId, session.user.id),
      ),
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
