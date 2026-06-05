import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bookmark, Loader2, Trash2, ChevronDown, ArrowRight, AlertTriangle, ExternalLink, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { totalScore } from "./project.$id";

export const Route = createFileRoute("/_authenticated/saved-ideas")({
  component: SavedIdeasPage,
});

type Scores = { pain: number; willingness_to_pay: number; simplicity: number; retention: number; fit: number };
type SourceLink = { url: string; title: string; platform: string; engagement?: string };
type SavedIdea = {
  name: string;
  evidence_strength?: "Strong" | "Medium" | "Weak";
  target_audience?: string;
  core_problem?: string;
  evidence_summary?: string;
  source_links?: SourceLink[];
  strongest_signal?: string;
  why_fits_user?: string;
  usage_frequency?: string;
  why_people_keep_paying?: string;
  fast_mvp?: string;
  unique_angle?: string;
  churn_risk?: string;
  validation_test?: string;
  scores?: Scores;
  final_verdict?: string;
};

type Row = {
  id: string;
  created_at: string;
  source_project_id: string | null;
  idea: SavedIdea;
};

const EVIDENCE_STYLES: Record<string, string> = {
  Strong: "border-green-500/40 bg-green-500/10 text-green-400",
  Medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  Weak: "border-red-500/40 bg-red-500/10 text-red-400",
};

function SavedIdeasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["saved-ideas-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_ideas")
        .select("id, created_at, source_project_id, idea")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("saved_ideas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["saved-ideas-all"] });
    qc.invalidateQueries({ queryKey: ["saved-ideas-names"] });
  };

  const startProject = async (row: Row) => {
    setStarting(row.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Not signed in"); return; }
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: u.user.id,
          name: row.idea.name ?? "From saved idea",
          status: "blueprint",
          chosen_idea: row.idea as never,
        })
        .select("id")
        .single();
      if (error || !data) { toast.error(error?.message ?? "Could not create project"); return; }
      toast.success("Project created");
      navigate({ to: "/project/$id", params: { id: data.id } });
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Bookmark className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Saved Ideas</h1>
        <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
          {rows?.length ?? 0}
        </span>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
          You haven't saved any ideas yet. Save ideas from the Discover or Score step in any project.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const idea = row.idea ?? {};
            const strength = idea.evidence_strength ?? "Weak";
            const total = totalScore(idea.scores as any);
            const totalColor = total >= 40 ? "text-green-500" : total >= 30 ? "text-yellow-500" : "text-muted-foreground";
            const isOpen = expanded === row.id;
            return (
              <div key={row.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                  className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-accent/30"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{idea.name ?? "Untitled idea"}</span>
                      <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", EVIDENCE_STYLES[strength] ?? EVIDENCE_STYLES.Weak)}>
                        {strength}
                      </span>
                      <span className={cn("rounded-md border border-border px-2 py-0.5 text-xs font-bold tabular-nums", totalColor)}>
                        {total}/50
                      </span>
                    </div>
                    {idea.target_audience && (
                      <p className="text-xs text-muted-foreground">{idea.target_audience}</p>
                    )}
                    {idea.final_verdict && (
                      <p className="line-clamp-2 text-sm text-foreground/90">{idea.final_verdict}</p>
                    )}
                  </div>
                  <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-border px-4 py-4 text-sm">
                    {idea.core_problem && <Detail label="Core problem" value={idea.core_problem} />}
                    {idea.evidence_summary && <Detail label="Evidence summary" value={idea.evidence_summary} />}
                    {idea.source_links && idea.source_links.length > 0 && (
                      <div>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Sources</span>
                        <div className="mt-2 space-y-1.5">
                          {idea.source_links.map((link, i) => (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs transition-colors hover:bg-accent/30">
                              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                              <div className="min-w-0">
                                <span className="block truncate font-medium text-foreground">{link.title}</span>
                                <span className="text-muted-foreground">
                                  {link.platform}{link.engagement ? ` · ${link.engagement}` : ""}
                                </span>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {idea.strongest_signal && <Detail label="Strongest signal" value={idea.strongest_signal} />}
                    {idea.why_fits_user && <Detail label="Why this fits you" value={idea.why_fits_user} />}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {idea.why_people_keep_paying && <Detail label="Why people keep paying" value={idea.why_people_keep_paying} />}
                      {idea.fast_mvp && <Detail label="Fast MVP version" value={idea.fast_mvp} />}
                      {idea.unique_angle && <Detail label="Unique angle" value={idea.unique_angle} />}
                      {idea.churn_risk && <Detail label="Churn risk" value={idea.churn_risk} />}
                    </div>
                    {idea.validation_test && <Detail label="Validation test" value={idea.validation_test} />}

                    {idea.scores && (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-wider text-muted-foreground">Scores (1–10)</span>
                          <span className={cn("text-xs font-bold tabular-nums", totalColor)}>Total {total}/50</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4">
                          {(Object.entries(idea.scores) as [string, number][]).map(([key, val]) => (
                            <div key={key} className="flex flex-col items-center gap-0.5">
                              <span className={cn("text-lg font-bold tabular-nums",
                                val >= 8 ? "text-green-500" : val >= 6 ? "text-yellow-500" : "text-muted-foreground")}>
                                {val}
                              </span>
                              <span className="text-xs capitalize text-muted-foreground">{key.replace(/_/g, " ")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {strength === "Weak" && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> Weak evidence — validate before building
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button
                        size="sm"
                        onClick={() => startProject(row)}
                        disabled={starting === row.id}
                        className="bg-gradient-electric text-primary-foreground shadow-glow"
                      >
                        {starting === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Start a project from this <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(row.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Saved {new Date(row.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
