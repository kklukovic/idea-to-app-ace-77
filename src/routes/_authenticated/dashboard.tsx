import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ArrowRight, Sparkles, Target, Zap, FileCode, Rocket, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const statusMeta: Record<string, { label: string; icon: any; tone: string }> = {
  profile: { label: "Profile", icon: Target, tone: "text-muted-foreground" },
  discover: { label: "Discovering", icon: Sparkles, tone: "text-primary" },
  score: { label: "Scoring", icon: Zap, tone: "text-primary" },
  blueprint: { label: "Blueprint", icon: FileCode, tone: "text-primary" },
  launch: { label: "Launch", icon: Rocket, tone: "text-warning" },
  completed: { label: "Completed", icon: CheckCircle2, tone: "text-success" },
};

function Dashboard() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").single()).data,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("id,name,status,updated_at").order("updated_at", { ascending: false }).limit(6)).data ?? [],
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary">Welcome back</div>
          <h1 className="mt-1 text-3xl font-bold">Hi, {profile?.full_name || "founder"}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Let ZITA help you find your next app idea.</p>
        </div>
        <Button asChild size="lg" className="bg-gradient-electric text-primary-foreground shadow-glow hover:opacity-90">
          <Link to="/projects/new"><Plus className="h-4 w-4" />Start new project</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <StatCard label="Credits" value={String(profile?.credits ?? 0)} hint={`Founder tier — ${profile?.founder_tier ?? "founder_47"}`} />
        <StatCard label="Projects" value={String(projects?.length ?? 0)} hint="Recent activity" />
        <StatCard label="Cost per project" value="~30 cr" hint="Discover 8 · Score 4 · Blueprint 10 · Launch 8" />
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent projects</h2>
          <Link to="/projects" className="text-sm text-primary hover:underline">View all <ArrowRight className="inline h-3 w-3" /></Link>
        </div>
        {projects && projects.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => {
              const m = statusMeta[p.status] ?? statusMeta.profile;
              return (
                <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="group rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold group-hover:text-primary">{p.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Updated {new Date(p.updated_at).toLocaleDateString()}</div>
                    </div>
                    <div className={cn("flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs", m.tone)}>
                      <m.icon className="h-3 w-3" />{m.label}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">No projects yet. ZITA is ready when you are.</p>
            <Button asChild className="mt-4 bg-gradient-electric text-primary-foreground shadow-glow">
              <Link to="/projects/new"><Plus className="h-4 w-4" />Start your first project</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gradient-electric">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
