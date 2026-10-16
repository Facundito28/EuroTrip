import { expect, it } from "vitest";
import { passwordSchema } from "../src/lib/password";
it("requires a long password, allows passphrases, and rejects bcrypt truncation", () => {
  expect(passwordSchema.safeParse("corta").success).toBe(false);
  expect(
    passwordSchema.safeParse("cuatro amigos recorren Europa").success,
  ).toBe(true);
  expect(passwordSchema.safeParse("á".repeat(40)).success).toBe(false);
  expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
});
