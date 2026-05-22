import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projects")({
  component: Projects,
});

function Projects() {
  const { data: projects } = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => (await supabase.from("projects").select("id,name,status,updated_at,created_at").order("updated_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">All your ZITA OS workspaces.</p>
        </div>
        <Button asChild className="bg-gradient-electric text-primary-foreground shadow-glow">
          <Link to="/projects/new"><Plus className="h-4 w-4" />New project</Link>
        </Button>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {projects && projects.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-accent/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Updated</th></tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-accent/20">
                  <td className="px-5 py-4">
                    <Link to="/project/$id" params={{ id: p.id }} className="font-medium hover:text-primary">{p.name}</Link>
                  </td>
                  <td className="px-5 py-4 capitalize text-muted-foreground">{p.status}</td>
                  <td className="px-5 py-4 text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">No projects yet.</div>
        )}
      </div>
    </div>
  );
}
