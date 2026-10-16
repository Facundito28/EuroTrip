import { configured, supabase } from "@/lib/supabase/server";
import { loadHQ } from "@/lib/data";
import { AccessScreen } from "@/components/access";
import { HQ } from "@/components/hq";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  if (!configured()) return <AccessScreen mode="setup" />;
  const client = await supabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return <AccessScreen mode="login" />;
  const { trip } = await searchParams;
  let data;
  try {
    data = await loadHQ(user.id, trip);
  } catch (error) {
    return (
      <AccessScreen
        mode="error"
        error={
          error instanceof Error ? error.message : "No se pudo cargar el viaje."
        }
      />
    );
  }
  if (!data) return <AccessScreen mode="create" email={user.email} />;
  return <HQ data={data} />;
}
