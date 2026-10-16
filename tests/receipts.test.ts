import { expect, it } from "vitest";
import {
  MAX_RECEIPT_BYTES,
  receiptMetadata,
  validReceiptPath,
} from "../src/lib/receipts";
const trip = "11111111-1111-4111-8111-111111111111",
  expense = "22222222-2222-4222-8222-222222222222",
  object = "33333333-3333-4333-8333-333333333333";
it("allows the advertised 5 MiB cap but rejects larger or executable files", () => {
  const data = {
    trip_id: trip,
    expense_id: expense,
    filename: "foto.png",
    content_type: "image/png",
    size: MAX_RECEIPT_BYTES,
  };
  expect(receiptMetadata.safeParse(data).success).toBe(true);
  expect(
    receiptMetadata.safeParse({ ...data, size: MAX_RECEIPT_BYTES + 1 }).success,
  ).toBe(false);
  expect(receiptMetadata.safeParse({ ...data, size: 0 }).success).toBe(false);
  expect(
    receiptMetadata.safeParse({ ...data, content_type: "text/html" }).success,
  ).toBe(false);
});
it("binds completion to the selected trip and expense and rejects traversal", () => {
  expect(
    validReceiptPath(`${trip}/${expense}/${object}.png`, trip, expense),
  ).toBe(true);
  expect(
    validReceiptPath(`${expense}/${trip}/${object}.png`, trip, expense),
  ).toBe(false);
  expect(
    validReceiptPath(`${trip}/${expense}/../${object}.png`, trip, expense),
  ).toBe(false);
  expect(
    validReceiptPath(`${trip}/${expense}/${object}.html`, trip, expense),
  ).toBe(false);
});
