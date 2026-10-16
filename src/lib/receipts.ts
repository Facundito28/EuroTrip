import { z } from "zod";
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const receiptExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const receiptMetadata = z.object({
  trip_id: z.uuid(),
  expense_id: z.uuid(),
  filename: z.string().min(1).max(200),
  content_type: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]),
  size: z
    .number()
    .int()
    .min(1, "Seleccioná un archivo.")
    .max(MAX_RECEIPT_BYTES, "El archivo debe tener hasta 5 MB."),
});
export function validReceiptPath(path: string, trip: string, expense: string) {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === trip &&
    parts[1] === expense &&
    /^[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/.test(parts[2]) &&
    z.uuid().safeParse(parts[2].split(".")[0]).success
  );
}
