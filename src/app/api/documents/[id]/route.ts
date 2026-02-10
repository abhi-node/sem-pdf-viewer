import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { del } from "@vercel/blob";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { document } from "@/db/schema";

export async function DELETE(
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
    .select()
    .from(document)
    .where(and(eq(document.id, id), eq(document.userId, session.user.id)));

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await del(doc.filename);
  } catch {
    // Blob already deleted — ignore
  }

  await db
    .delete(document)
    .where(and(eq(document.id, id), eq(document.userId, session.user.id)));

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, lastPage } = body;

  const updates: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title must be a non-empty string" },
        { status: 400 },
      );
    }
    updates.title = title.trim();
  }

  if (lastPage !== undefined) {
    if (!Number.isInteger(lastPage) || lastPage < 1) {
      return NextResponse.json(
        { error: "lastPage must be a positive integer" },
        { status: 400 },
      );
    }
    updates.lastPage = lastPage;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(document)
    .set(updates)
    .where(and(eq(document.id, id), eq(document.userId, session.user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
