import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  if (token_hash) {
    const client = await supabase();
    const { error } = await client.auth.verifyOtp({
      token_hash,
      type: "email",
    });
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL("/?auth_error=expired", request.url));
}
