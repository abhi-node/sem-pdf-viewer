import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { document } from "@/db/schema";
import { inngest } from "@/inngest/client";

const UPLOADS_DIR = join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 50MB limit" },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const filename = `${id}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(join(UPLOADS_DIR, filename), buffer);

  const title = file.name.replace(/\.pdf$/i, "");
  const now = new Date();

  const [created] = await db
    .insert(document)
    .values({
      id,
      userId: session.user.id,
      title,
      filename,
      fileSize: file.size,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await inngest.send({
    name: "document/uploaded",
    data: {
      documentId: id,
      userId: session.user.id,
      filename,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
