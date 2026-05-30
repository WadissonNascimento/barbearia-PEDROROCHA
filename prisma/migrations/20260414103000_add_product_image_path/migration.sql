-- Store only the Supabase Storage object path in the database.
ALTER TABLE "Product" ADD COLUMN "image_path" TEXT;

