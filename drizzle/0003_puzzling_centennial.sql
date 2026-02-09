CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "document_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "ingestion_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunk" ADD CONSTRAINT "document_chunk_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dc_document_id_idx" ON "document_chunk" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "dc_user_id_idx" ON "document_chunk" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dc_embedding_idx" ON "document_chunk" USING hnsw ("embedding" vector_cosine_ops);