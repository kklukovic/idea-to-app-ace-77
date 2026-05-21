import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").single()).data,
  });
  const { data: usage } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => (await supabase.from("credit_usage").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="mt-8 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-semibold">Profile</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Name</dt><dd className="mt-1">{profile?.full_name || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Email</dt><dd className="mt-1">{profile?.email}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Tier</dt><dd className="mt-1 capitalize">{profile?.founder_tier?.replace("_", " ")}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Credits</dt><dd className="mt-1 flex items-center gap-1.5 font-mono"><Coins className="h-3 w-3 text-primary" />{profile?.credits ?? 0}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-semibold">Credit usage history</h2>
          {usage && usage.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="pb-2">When</th><th className="pb-2">Action</th><th className="pb-2 text-right">Credits</th></tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="py-2 text-muted-foreground">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="py-2 capitalize">{u.action}</td>
                    <td className="py-2 text-right font-mono">-{u.credits_used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="mt-4 text-sm text-muted-foreground">No usage yet.</p>}
        </div>
      </div>
    </div>
  );
}
