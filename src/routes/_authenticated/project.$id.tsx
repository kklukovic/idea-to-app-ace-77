import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Target, Sparkles, Zap, FileCode, Rocket, Check, Lock, ArrowRight, Loader2,
  RefreshCw, ChevronDown, Copy, Download, ExternalLink, AlertTriangle, Bookmark, BookmarkCheck,
} from "lucide-react";
import { type Idea, type ScoredIdea } from "@/lib/zita.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/project/$id")({
  component: ProjectWorkspace,
});

type Status = "profile" | "discover" | "score" | "blueprint" | "launch" | "completed";
const STEPS: { key: Status; label: string; icon: any; desc: string }[] = [
  { key: "profile", label: "Profile", icon: Target, desc: "Tell ZITA about you and your audience." },
  { key: "discover", label: "Discover", icon: Sparkles, desc: "Find real, painful problems worth solving." },
  { key: "score", label: "Score", icon: Zap, desc: "Rank ideas across 6 dimensions." },
  { key: "blueprint", label: "Blueprint", icon: FileCode, desc: "Generate the build spec for your tool." },
  { key: "launch", label: "Launch", icon: Rocket, desc: "Get your launch kit and go live." },
];
const idx = (s: string) => Math.max(0, STEPS.findIndex((x) => x.key === s));

function ProjectWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) {
        console.error("Failed to load project:", error);
        throw error;
      }
      return data;
    },
  });

  useEffect(() => {
    if (error) console.error("Project workspace error:", error);
  }, [error]);

  const reached = project ? (project.status === "completed" ? 4 : idx(project.status)) : 0;
  const [active, setActive] = useState<Status>("profile");

  useEffect(() => {
    if (project) setActive((project.status === "completed" ? "launch" : project.status) as Status);
  }, [project?.status]);

  if (isLoading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error || !project) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-sm text-muted-foreground">Could not load this project.</div>;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["project", id] });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <ProjectHeader project={project} onSaved={refresh} />

      <StepBar active={active} reached={reached} status={project.status} onPick={setActive} />

      <div className="mt-8">
        {active === "profile" && <ProfilePanel project={project} onSaved={(next) => { refresh(); setActive(next); }} />}
        {active === "discover" && <DiscoverPanel project={project} onSaved={(next) => { refresh(); setActive(next); }} />}
        {active === "score" && <ScorePanel project={project} onSaved={(next) => { refresh(); setActive(next); }} />}
        {active === "blueprint" && <BlueprintPanel project={project} onSaved={(next) => { refresh(); setActive(next); }} />}
        {active === "launch" && <LaunchPanel project={project} onSaved={(next) => { refresh(); setActive(next); }} />}
      </div>
    </div>
  );
}

// ---------- Header with inline-editable name + status badge ----------
function ProjectHeader({ project, onSaved }: { project: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  useEffect(() => setName(project.name), [project.name]);

  const save = async () => {
    setEditing(false);
    const trimmed = name.trim() || "Untitled Project";
    if (trimmed === project.name) return;
    const { error } = await supabase.from("projects").update({ name: trimmed, updated_at: new Date().toISOString() }).eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Renamed");
    onSaved();
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="text-xs uppercase tracking-widest text-primary">Project</div>
      {editing ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(project.name); setEditing(false); } }}
          className="h-9 max-w-md text-xl font-bold"
        />
      ) : (
        <h1 onClick={() => setEditing(true)} className="cursor-text rounded px-1 text-2xl font-bold hover:bg-accent/40" title="Click to rename">
          {project.name}
        </h1>
      )}
      <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs uppercase tracking-wider text-primary">
        {project.status}
      </span>
    </div>
  );
}

// ---------- Step bar ----------
function StepBar({ active, reached, status, onPick }: { active: Status; reached: number; status: string; onPick: (s: Status) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="relative flex items-center justify-between gap-2">
        <div className="absolute left-5 right-5 top-5 h-0.5 -translate-y-1/2 bg-border" />
        <div className="absolute left-5 top-5 h-0.5 -translate-y-1/2 bg-gradient-electric transition-all" style={{ width: `calc((100% - 2.5rem) * ${reached / (STEPS.length - 1)})` }} />
        {STEPS.map((s, i) => {
          const locked = i > reached;
          const done = i < reached || status === "completed";
          const current = active === s.key;
          return (
            <button
              key={s.key}
              disabled={locked}
              onClick={() => !locked && onPick(s.key)}
              title={locked ? "Complete previous steps first" : s.label}
              className={cn(
                "relative z-10 flex flex-1 flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition",
                locked ? "cursor-not-allowed opacity-40" : "hover:bg-accent/40",
              )}
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition",
                current && "border-primary bg-gradient-electric text-primary-foreground shadow-glow",
                !current && done && "border-success bg-success/20 text-success",
                !current && !done && !locked && "border-border bg-card text-foreground",
                locked && "border-border bg-card text-muted-foreground",
              )}>
                {locked ? <Lock className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <s.icon className={cn("h-3 w-3", current ? "text-primary" : "text-muted-foreground")} />
                <span className={cn(current && "font-semibold text-foreground", !current && "text-muted-foreground")}>{s.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Step 1: Profile (fully functional) ----------
const NICHES = ["Make Money Online", "Health & Fitness", "Weight Loss", "Productivity", "Relationships", "Creators & Content", "Local Business", "Affiliate Marketing"];
const TOOL_TYPES = ["Lead magnet", "Paid mini-tool", "Client tool", "Internal business tool", "Not sure yet"];
const SKILLS = ["Beginner", "Intermediate", "Advanced"];
const TIMES = ["Under 5h", "5-10h", "10-20h", "20+h"];

function ProfilePanel({ project, onSaved }: { project: any; onSaved: (next: Status) => void }) {
  const existing = (project.profile_data ?? {}) as Record<string, string>;
  const [form, setForm] = useState({
    niche: existing.niche ?? "",
    expertise: existing.expertise ?? "",
    audience: existing.audience ?? "",
    offer: existing.offer ?? "",
    topic: existing.topic ?? "",
    tool_type: existing.tool_type ?? "Not sure yet",
    skill_level: existing.skill_level ?? "Beginner",
    // normalise legacy "<5h" value to the new label
    time_per_week: (existing.time_per_week === "<5h" ? "Under 5h" : existing.time_per_week) || "5-10h",
  });
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    !!(existing.expertise || existing.audience || existing.offer || existing.topic),
  );

  const persist = async () => {
    setSaving(true);
    const nextStatus = project.status === "profile" ? "discover" : project.status;
    const { error } = await supabase
      .from("projects")
      .update({ profile_data: form, status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const handleSave = async () => {
    if (await persist()) {
      toast.success("Profile saved — Discover unlocked");
      onSaved("discover");
    }
  };

  const handleSkip = async () => {
    if (await persist()) onSaved("discover");
  };

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-card">
      <div>
        <h2 className="text-lg font-semibold">Step 1 — Your Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ZITA uses this to tailor every idea to you. Fill what you know — nothing is required.
        </p>
      </div>

      {/* Niche picker */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pick a niche</Label>
        <div className="flex flex-wrap gap-2">
          {NICHES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setForm({ ...form, niche: form.niche === n ? "" : n })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                form.niche === n
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <Input
          value={NICHES.includes(form.niche) ? "" : form.niche}
          onChange={(e) => setForm({ ...form, niche: e.target.value })}
          placeholder="Or type your own niche…"
          className="mt-1"
        />
      </div>

      <RadioGroup label="Preferred tool type" value={form.tool_type} options={TOOL_TYPES} onChange={(v) => setForm({ ...form, tool_type: v })} />
      <RadioGroup label="Your build skill level" value={form.skill_level} options={SKILLS} onChange={(v) => setForm({ ...form, skill_level: v })} />
      <RadioGroup label="Time available per week" value={form.time_per_week} options={TIMES} onChange={(v) => setForm({ ...form, time_per_week: v })} />

      {/* Collapsible optional detail */}
      <div className="overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition hover:bg-accent/30"
        >
          <span>
            Tell ZITA more{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", moreOpen && "rotate-180")} />
        </button>
        {moreOpen && (
          <div className="space-y-4 border-t border-border px-4 py-4">
            <Field label="What do you do?">
              <Textarea rows={2} value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} placeholder="Your expertise / background" />
            </Field>
            <Field label="Who do you help?">
              <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Target audience" />
            </Field>
            <Field label="What do you sell or want to sell?">
              <Textarea rows={2} value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="Your current or planned offer" />
            </Field>
            <Field label="Problem area or niche of interest">
              <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. freelancers, e-commerce, productivity…" />
            </Field>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-electric text-primary-foreground shadow-glow">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save & Continue <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={handleSkip} disabled={saving} className="text-muted-foreground hover:text-foreground">
          Skip to ideas
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RadioGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              value === o
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Step 2: Discover ----------

type DiscoverMode = "personalized" | "surprise" | "validate";

const DISCOVER_MODES: { key: DiscoverMode; title: string; desc: string }[] = [
  {
    key: "personalized",
    title: "Personalized Ideas",
    desc: "Researches ideas tailored to your niche, audience, and profile.",
  },
  {
    key: "surprise",
    title: "Surprise Me",
    desc: "Generates diverse random seeds, then searches for real market evidence.",
  },
  {
    key: "validate",
    title: "Validate My Idea",
    desc: "Enter a rough idea — get stronger researched variants and adjacent angles.",
  },
];

const LOADING_STEPS = [
  "Generating idea hypotheses...",
  "Searching real discussions...",
  "Reading what people actually want...",
  "Scoring the evidence...",
  "Building your idea cards...",
];

type SourceLink = { url: string; title: string; platform: string; engagement?: string };

type ResearchedIdea = {
  name: string;
  evidence_strength: "Strong" | "Medium" | "Weak";
  target_audience: string;
  core_problem: string;
  evidence_summary: string;
  source_links: SourceLink[];
  strongest_signal: string;
  why_fits_user: string;
  usage_frequency: string;
  why_people_keep_paying: string;
  fast_mvp: string;
  unique_angle: string;
  churn_risk: string;
  validation_test: string;
  scores: { pain: number; willingness_to_pay: number; simplicity: number; retention: number; fit: number };
  final_verdict: string;
};

// Total score across the 5 sub-scores (out of 50). Single source of truth — change here to adjust formula.
export function totalScore(scores: ResearchedIdea["scores"] | undefined | null): number {
  if (!scores) return 0;
  return (scores.pain ?? 0) + (scores.willingness_to_pay ?? 0) + (scores.simplicity ?? 0) + (scores.retention ?? 0) + (scores.fit ?? 0);
}

function useSavedIdeas(projectId: string) {
  const qc = useQueryClient();
  const { data: savedNames } = useQuery({
    queryKey: ["saved-ideas-names", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("saved_ideas").select("idea").eq("source_project_id", projectId);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => { const n = r?.idea?.name; if (n) set.add(n); });
      return set;
    },
  });
  const save = async (idea: ResearchedIdea) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Not signed in"); return; }
    const { error } = await supabase.from("saved_ideas").insert({
      user_id: u.user.id,
      source_project_id: projectId,
      idea: idea as never,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Saved "${idea.name}" for later`);
    qc.invalidateQueries({ queryKey: ["saved-ideas-names", projectId] });
    qc.invalidateQueries({ queryKey: ["saved-ideas-all"] });
  };
  return { savedNames: savedNames ?? new Set<string>(), save };
}

function DiscoverPanel({ project, onSaved }: { project: any; onSaved: (next: Status) => void }) {
  const rawIdeas = project.ideas as any[] | null;
  const existingIdeas: ResearchedIdea[] | null =
    rawIdeas && rawIdeas.length > 0 && typeof rawIdeas[0]?.evidence_strength === "string"
      ? (rawIdeas as ResearchedIdea[])
      : null;

  const [mode, setMode] = useState<DiscoverMode>("personalized");
  const [roughIdea, setRoughIdea] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [ideas, setIdeas] = useState<ResearchedIdea[] | null>(existingIdeas);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [chosen, setChosen] = useState<string | null>(
    (project.chosen_idea as any)?.name ?? null,
  );
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const { savedNames, save: saveForLater } = useSavedIdeas(project.id);

  useEffect(() => {
    if (!running) { setLoadingStepIdx(0); return; }
    const interval = setInterval(() => {
      setLoadingStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 14000);
    return () => clearInterval(interval);
  }, [running]);

  const run = async (isRegen = false) => {
    setRunning(true);
    setDiscoverError(null);
    setLoadingStepIdx(0);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ideas", {
        body: { projectId: project.id, mode, roughIdea: mode === "validate" ? roughIdea : "" },
      });
      if (error) {
        let msg = error.message ?? "Research failed — try again.";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.ideas)) throw new Error("Unexpected response — try again.");
      setIdeas(data.ideas as ResearchedIdea[]);
      toast.success(isRegen ? "Ideas refreshed!" : `${data.ideas.length} researched ideas ready!`);
    } catch (err: any) {
      const msg = err?.message ?? "Research failed — try again.";
      console.error("generate-ideas error:", err);
      setDiscoverError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const chooseIdea = async (idea: ResearchedIdea) => {
    const { error } = await supabase
      .from("projects")
      .update({ chosen_idea: idea as never, status: "score", updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    setChosen(idea.name);
    toast.success(`"${idea.name}" selected`);
    onSaved("score");
  };

  const continueToScore = async () => {
    if (["profile", "discover"].includes(project.status as string)) {
      const { error } = await supabase
        .from("projects")
        .update({ status: "score", updated_at: new Date().toISOString() })
        .eq("id", project.id);
      if (error) { toast.error(error.message); return; }
    }
    onSaved("score");
  };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Step 2 — Discover Ideas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI researches real online discussions to find ideas with evidence behind them.
          </p>
        </div>
        {ideas && !running && (
          <Button variant="outline" size="sm" onClick={() => run(true)} disabled={running}>
            <RefreshCw className="h-3.5 w-3.5" />
            Re-research (10 credits)
          </Button>
        )}
      </div>

      {/* Mode selector */}
      {!ideas && !running && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DISCOVER_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition",
                  mode === m.key
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/20",
                )}
              >
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.desc}</div>
              </button>
            ))}
          </div>

          {mode === "validate" && (
            <Textarea
              rows={3}
              value={roughIdea}
              onChange={(e) => setRoughIdea(e.target.value)}
              placeholder="Describe your rough idea... e.g. 'A tool that helps freelancers track unpaid invoices'"
            />
          )}

          <Button
            onClick={() => run()}
            disabled={mode === "validate" && !roughIdea.trim()}
            className="bg-gradient-electric text-primary-foreground shadow-glow"
          >
            <Sparkles className="h-4 w-4" />
            Research Ideas (10 credits)
          </Button>
        </>
      )}

      {/* Sequential loading states */}
      {running && (
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            {LOADING_STEPS.map((step, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 transition-opacity",
                  i > loadingStepIdx && "opacity-25",
                )}
              >
                {i < loadingStepIdx ? (
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                ) : i === loadingStepIdx ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <div className="h-4 w-4 shrink-0 rounded-full border border-border" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    i === loadingStepIdx ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            This can take 30–90 seconds — web research takes time.
          </p>
        </div>
      )}

      {/* Error state */}
      {discoverError && !running && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Research failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{discoverError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => run()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Ideas list */}
      {ideas && !running && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {ideas.length} ideas researched
          </p>
          {ideas.map((idea, i) => (
            <ResearchIdeaCard
              key={i}
              idea={idea}
              expanded={expanded === i}
              isChosen={chosen === idea.name}
              onToggle={() => setExpanded(expanded === i ? null : i)}
              onChoose={() => chooseIdea(idea)}
              isSaved={savedNames.has(idea.name)}
              onSave={() => saveForLater(idea)}
            />
          ))}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => run(true)} disabled={running}>
              <RefreshCw className="h-4 w-4" />
              I don't like these — give me 10 more (10 credits)
            </Button>
            <Button
              onClick={continueToScore}
              className="bg-gradient-electric text-primary-foreground shadow-glow"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const EVIDENCE_STYLES: Record<string, string> = {
  Strong: "border-green-500/40 bg-green-500/10 text-green-400",
  Medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  Weak: "border-red-500/40 bg-red-500/10 text-red-400",
};

function ResearchIdeaCard({
  idea,
  expanded,
  isChosen,
  onToggle,
  onChoose,
  isSaved,
  onSave,
  rank,
  showTotal,
}: {
  idea: ResearchedIdea;
  expanded: boolean;
  isChosen: boolean;
  onToggle: () => void;
  onChoose: () => void;
  isSaved?: boolean;
  onSave?: () => void;
  rank?: number;
  showTotal?: boolean;
}) {
  const strength = idea.evidence_strength ?? "Weak";
  const isWeak = strength === "Weak";
  const total = totalScore(idea.scores);
  const totalColor = total >= 40 ? "text-green-500" : total >= 30 ? "text-yellow-500" : "text-muted-foreground";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        isChosen ? "border-primary" : isWeak ? "border-amber-500/20" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-accent/30"
      >
        {typeof rank === "number" && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-bold text-primary">
            {rank}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{idea.name}</span>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-semibold",
                EVIDENCE_STYLES[strength] ?? EVIDENCE_STYLES.Weak,
              )}
            >
              {strength}
            </span>
            {showTotal && (
              <span className={cn("rounded-md border border-border px-2 py-0.5 text-xs font-bold tabular-nums", totalColor)}>
                {total}/50
              </span>
            )}
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {idea.usage_frequency}
            </span>
            {isChosen && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Check className="h-3 w-3" /> Chosen
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{idea.target_audience}</p>
          <p className="line-clamp-2 text-sm text-foreground/90">{idea.core_problem}</p>
          {showTotal && idea.final_verdict && (
            <p className="line-clamp-1 text-xs italic text-muted-foreground">{idea.final_verdict}</p>
          )}
          {isWeak && (
            <p className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Weak evidence — validate before building
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border px-4 py-4 text-sm">
          <IdeaDetail label="Evidence summary" value={idea.evidence_summary} />

          {idea.source_links && idea.source_links.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Sources</span>
              <div className="mt-2 space-y-1.5">
                {idea.source_links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs transition-colors hover:bg-accent/30"
                  >
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{link.title}</span>
                      <span className="text-muted-foreground">
                        {link.platform}
                        {link.engagement ? ` · ${link.engagement}` : ""}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <IdeaDetail label="Strongest signal" value={idea.strongest_signal} />
          <IdeaDetail label="Why this fits you" value={idea.why_fits_user} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <IdeaDetail label="Why people keep paying" value={idea.why_people_keep_paying} />
            <IdeaDetail label="Fast MVP version" value={idea.fast_mvp} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <IdeaDetail label="Unique angle" value={idea.unique_angle} />
            <IdeaDetail label="Churn risk" value={idea.churn_risk} />
          </div>

          <IdeaDetail label="Validation test" value={idea.validation_test} />

          {idea.scores && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Scores (1–10)
                </span>
                <span className={cn("text-xs font-bold tabular-nums", totalColor)}>
                  Total {total}/50
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                {(Object.entries(idea.scores) as [string, number][]).map(([key, val]) => (
                  <div key={key} className="flex flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        val >= 8
                          ? "text-green-500"
                          : val >= 6
                          ? "text-yellow-500"
                          : "text-muted-foreground",
                      )}
                    >
                      {val}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {key.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Verdict</span>
            <p className="mt-1 font-medium text-foreground">{idea.final_verdict}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button
              size="sm"
              variant={isChosen ? "default" : "outline"}
              onClick={onChoose}
              className={cn(
                isChosen && "border-primary/30 bg-primary/20 text-primary hover:bg-primary/30",
              )}
            >
              {isChosen ? (
                <><Check className="h-3 w-3" /> Chosen</>
              ) : (
                "Choose this idea"
              )}
            </Button>
            {onSave && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onSave}
                disabled={isSaved}
                className="text-muted-foreground hover:text-foreground"
              >
                {isSaved ? <><BookmarkCheck className="h-3 w-3" /> Saved</> : <><Bookmark className="h-3 w-3" /> Save for later</>}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

// ---------- Step 3: Score ----------
function ScorePanel({ project, onSaved }: { project: any; onSaved: (next: Status) => void }) {
  const existingScored = (project.scored_ideas as ScoredIdea[] | null) ?? null;
  const existingChosen = (project.chosen_idea as { name: string } | null)?.name ?? null;
  const autoRun = !existingScored;
  const didAutoRun = useRef(false);

  const [scored, setScored] = useState<ScoredIdea[] | null>(existingScored);
  const [chosen, setChosen] = useState<string | null>(existingChosen);
  const [running, setRunning] = useState(autoRun);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setScoreError(null);
    try {
      const { data, error } = await supabase.functions.invoke("score-ideas", {
        body: { projectId: project.id },
      });

      // supabase-js wraps non-2xx responses in a FunctionsHttpError whose
      // .message is a generic string. Pull the actual message from the body.
      if (error) {
        let msg = error.message ?? "Scoring failed — try again.";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.scored)) throw new Error("Unexpected response from score-ideas — try again.");

      setScored(data.scored);
      toast.success("Ideas scored!");
    } catch (err: any) {
      const msg = err?.message ?? "Scoring failed — try again.";
      console.error("score-ideas error:", err);
      setScoreError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoRun && !didAutoRun.current) {
      didAutoRun.current = true;
      run();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (ideaName: string) => {
    const ideaObj =
      (project.ideas as Idea[] | null)?.find((i) => i.name === ideaName) ??
      { name: ideaName };
    const { error } = await supabase
      .from("projects")
      .update({ chosen_idea: ideaObj, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    setChosen(ideaName);
    toast.success(`"${ideaName}" selected`);
  };

  const goToBlueprint = async () => {
    const below = ["profile", "discover", "score"];
    if (below.includes(project.status as string)) {
      const { error } = await supabase
        .from("projects")
        .update({ status: "blueprint", updated_at: new Date().toISOString() })
        .eq("id", project.id);
      if (error) { toast.error(error.message); return; }
    }
    onSaved("blueprint");
  };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Step 3 — Score Ideas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ranked across 6 founder-fit dimensions. Pick the one you'll build.</p>
        </div>
        {scored && !running && (
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            <RefreshCw className="h-3.5 w-3.5" />
            Re-score (4 credits)
          </Button>
        )}
      </div>

      {/* Loading skeleton */}
      {running && (
        <div className="space-y-3">
          <p className="animate-pulse text-sm text-muted-foreground">Scoring ideas — this can take 15–30 s…</p>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-2.5 h-4 w-1/4 rounded bg-muted" />
              <div className="flex gap-2">
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} className="h-5 w-9 rounded bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state with Retry */}
      {scoreError && !running && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Scoring failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{scoreError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={run}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Ranked table */}
      {scored && !running && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="px-3 py-2.5 text-left font-medium">#</th>
                  <th className="px-3 py-2.5 text-left font-medium">Idea</th>
                  <th className="px-3 py-2.5 text-center font-medium" title="Pain level">Pain</th>
                  <th className="px-3 py-2.5 text-center font-medium" title="Build ease">Build</th>
                  <th className="px-3 py-2.5 text-center font-medium" title="Monetization potential">$$$</th>
                  <th className="px-3 py-2.5 text-center font-medium" title="Content potential">Content</th>
                  <th className="px-3 py-2.5 text-center font-medium" title="Conversation potential">Convo</th>
                  <th className="px-3 py-2.5 text-center font-medium" title="Founder offer potential">Offer</th>
                  <th className="px-3 py-2.5 text-center font-medium">Total</th>
                  <th className="px-3 py-2.5 text-left font-medium">Verdict</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {scored.map((idea, i) => {
                  const isChosen = chosen === idea.name;
                  return (
                    <tr
                      key={idea.name}
                      className={cn(
                        "border-b border-border last:border-0 transition",
                        isChosen ? "bg-primary/10" : "hover:bg-accent/20",
                      )}
                    >
                      <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {isChosen && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                          <span className={cn("font-medium", isChosen && "text-primary")}>{idea.name}</span>
                        </div>
                      </td>
                      <ScoreCell v={idea.scores.pain_level} />
                      <ScoreCell v={idea.scores.build_ease} />
                      <ScoreCell v={idea.scores.monetization_potential} />
                      <ScoreCell v={idea.scores.content_potential} />
                      <ScoreCell v={idea.scores.conversation_potential} />
                      <ScoreCell v={idea.scores.founder_offer_potential} />
                      <td className="px-3 py-3 text-center">
                        <span className={cn(
                          "font-bold tabular-nums",
                          idea.total >= 48 ? "text-green-500" : idea.total >= 36 ? "text-yellow-500" : "text-muted-foreground",
                        )}>
                          {idea.total}/60
                        </span>
                      </td>
                      <td className="max-w-[180px] px-3 py-3 text-xs text-muted-foreground">
                        <p className="line-clamp-2">{idea.verdict}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant={isChosen ? "default" : "outline"}
                          onClick={() => choose(idea.name)}
                          className={cn(isChosen && "border-primary/30 bg-primary/20 text-primary hover:bg-primary/30")}
                        >
                          {isChosen ? <><Check className="h-3 w-3" /> Chosen</> : "Choose this Idea"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom CTA */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button
              onClick={goToBlueprint}
              disabled={!chosen}
              className="bg-gradient-electric text-primary-foreground shadow-glow"
            >
              Create Blueprint <ArrowRight className="h-4 w-4" />
            </Button>
            {!chosen && (
              <p className="text-xs text-muted-foreground">Choose an idea above to continue</p>
            )}
            {chosen && (
              <p className="text-xs text-muted-foreground">
                Building: <span className="font-medium text-foreground">{chosen}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCell({ v }: { v: number }) {
  const color = v >= 8 ? "text-green-500" : v >= 6 ? "text-yellow-500" : "text-muted-foreground";
  return (
    <td className={cn("px-3 py-3 text-center font-medium tabular-nums", color)}>{v}</td>
  );
}

// ---------- Step 4: Blueprint ----------
function extractBuildPrompt(md: string): string {
  const marker = "## Lovable Build Prompt";
  const idx = md.indexOf(marker);
  if (idx === -1) return md;
  const after = md.slice(idx + marker.length).trim();
  // Strip fences if the prompt is inside a code block
  const fenced = after.match(/^```[\w]*\n?([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : after;
}

function BlueprintPanel({ project, onSaved }: { project: any; onSaved: (next: Status) => void }) {
  const existingMd = (project.blueprint_markdown as string | null) ?? null;
  const autoRun = !existingMd;
  const didAutoRun = useRef(false);

  const [md, setMd] = useState<string | null>(existingMd);
  const [running, setRunning] = useState(autoRun);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setBlueprintError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blueprint", {
        body: { projectId: project.id },
      });
      if (error) {
        let msg = error.message ?? "Blueprint generation failed — try again.";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (typeof data?.markdown !== "string") throw new Error("Unexpected response from generate-blueprint — try again.");
      setMd(data.markdown);
      toast.success("Blueprint generated!");
    } catch (err: any) {
      const msg = err?.message ?? "Blueprint generation failed — try again.";
      console.error("generate-blueprint error:", err);
      setBlueprintError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoRun && !didAutoRun.current) {
      didAutoRun.current = true;
      run();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyAll = () =>
    navigator.clipboard.writeText(md ?? "").then(() => toast.success("Blueprint copied!"));

  const copyBuildPrompt = () =>
    navigator.clipboard.writeText(extractBuildPrompt(md ?? "")).then(() => toast.success("Build prompt copied!"));

  const download = () => {
    const ideaName = (project.chosen_idea as any)?.name ?? project.id;
    const safeName = ideaName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const blob = new Blob([md ?? ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blueprint-${safeName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const goToLaunch = async () => {
    const below = ["profile", "discover", "score", "blueprint"];
    if (below.includes(project.status as string)) {
      const { error } = await supabase
        .from("projects")
        .update({ status: "launch", updated_at: new Date().toISOString() })
        .eq("id", project.id);
      if (error) { toast.error(error.message); return; }
    }
    onSaved("launch");
  };

  const ideaName = (project.chosen_idea as any)?.name ?? "your idea";

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Step 4 — Blueprint</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build-ready PRD for <span className="font-medium text-foreground">{ideaName}</span>.
          </p>
        </div>
        {md && !running && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyAll}>
              <Copy className="h-3.5 w-3.5" />
              Copy Blueprint
            </Button>
            <Button variant="outline" size="sm" onClick={copyBuildPrompt}>
              <Copy className="h-3.5 w-3.5" />
              Copy Build Prompt
            </Button>
            <Button variant="outline" size="sm" onClick={download}>
              <Download className="h-3.5 w-3.5" />
              Download .md
            </Button>
            <Button variant="outline" size="sm" onClick={run} disabled={running}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate (10 credits)
            </Button>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {running && (
        <div className="space-y-5">
          <p className="animate-pulse text-sm text-muted-foreground">Generating blueprint — this can take 15–30 s…</p>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className={cn("h-5 rounded bg-muted", i % 3 === 0 ? "w-1/3" : "w-1/2")} />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
              {i % 2 === 0 && <div className="h-3 w-2/3 rounded bg-muted" />}
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {blueprintError && !running && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Blueprint generation failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{blueprintError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={run}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Rendered blueprint */}
      {md && !running && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-6">
            <MarkdownView md={md} />
          </div>
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button onClick={goToLaunch} className="bg-gradient-electric text-primary-foreground shadow-glow">
              Create Launch Plan <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MarkdownView({ md }: { md: string }) {
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const parseLine = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, idx) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={idx}>{p.slice(2, -2)}</strong>
        : p
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      nodes.push(
        <h1 key={i} className="mb-3 mt-2 text-2xl font-bold text-foreground">
          {parseLine(line.slice(2))}
        </h1>,
      );
      i++;
    } else if (line.startsWith("## ")) {
      const headText = line.slice(3);
      const headId = headText.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      nodes.push(
        <h2 key={i} id={headId} className="mb-2 mt-7 scroll-mt-4 border-b border-border pb-1.5 text-base font-semibold text-foreground first:mt-0">
          {parseLine(headText)}
        </h2>,
      );
      i++;
    } else if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={i} className="mb-1.5 mt-4 text-sm font-semibold text-foreground">
          {parseLine(line.slice(4))}
        </h3>,
      );
      i++;
    } else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={i} className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      i++; // skip closing ```
    } else if (line.match(/^[-*] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-2 ml-5 list-disc space-y-1">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-foreground/90">{parseLine(item)}</li>
          ))}
        </ul>,
      );
    } else if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={i} className="my-2 ml-5 list-decimal space-y-1">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-foreground/90">{parseLine(item)}</li>
          ))}
        </ol>,
      );
    } else if (line.trim() === "") {
      i++;
    } else {
      nodes.push(
        <p key={i} className="my-1.5 text-sm leading-relaxed text-foreground/90">
          {parseLine(line)}
        </p>,
      );
      i++;
    }
  }

  return <div>{nodes}</div>;
}

// ---------- Step 5: Launch ----------
function slugify(text: string) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function LaunchToc({ md }: { md: string }) {
  const sections = md
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => {
      const text = l.slice(3).trim();
      return { text, id: slugify(text) };
    });
  if (!sections.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">Jump to:</span>
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="text-xs text-primary underline-offset-2 hover:underline">
          {s.text}
        </a>
      ))}
    </div>
  );
}

function LaunchPanel({ project, onSaved }: { project: any; onSaved: (next: Status) => void }) {
  const existingMd = (project.launch_kit_markdown as string | null) ?? null;
  const autoRun = !existingMd;
  const didAutoRun = useRef(false);

  const [md, setMd] = useState<string | null>(existingMd);
  const [running, setRunning] = useState(autoRun);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const run = async () => {
    setRunning(true);
    setLaunchError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-launch", {
        body: { projectId: project.id },
      });
      if (error) {
        let msg = error.message ?? "Launch kit generation failed — try again.";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (typeof data?.markdown !== "string") throw new Error("Unexpected response from generate-launch — try again.");
      setMd(data.markdown);
      toast.success("Launch kit generated!");
    } catch (err: any) {
      const msg = err?.message ?? "Launch kit generation failed — try again.";
      console.error("generate-launch error:", err);
      setLaunchError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoRun && !didAutoRun.current) {
      didAutoRun.current = true;
      run();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyAll = () =>
    navigator.clipboard.writeText(md ?? "").then(() => toast.success("Launch kit copied!"));

  const download = () => {
    const ideaName = (project.chosen_idea as any)?.name ?? project.id;
    const safeName = ideaName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const blob = new Blob([md ?? ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `launch-kit-${safeName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const complete = async () => {
    setCompleting(true);
    const { error } = await supabase
      .from("projects")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", project.id);
    setCompleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project marked as completed — congratulations!");
    onSaved("launch");
  };

  const isCompleted = project.status === "completed";
  const ideaName = (project.chosen_idea as any)?.name ?? "your idea";

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Step 5 — Launch Kit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your full launch plan for <span className="font-medium text-foreground">{ideaName}</span>.
          </p>
        </div>
        {md && !running && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyAll}>
              <Copy className="h-3.5 w-3.5" />
              Copy All
            </Button>
            <Button variant="outline" size="sm" onClick={download}>
              <Download className="h-3.5 w-3.5" />
              Download .md
            </Button>
            <Button variant="outline" size="sm" onClick={run} disabled={running}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate (8 credits)
            </Button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {running && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating launch kit — this can take 15–30 s…</p>
          </div>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className={cn("h-5 rounded bg-muted", i % 3 === 0 ? "w-1/3" : i % 3 === 1 ? "w-1/2" : "w-2/5")} />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
              {i % 2 === 0 && <div className="h-3 w-2/3 rounded bg-muted" />}
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {launchError && !running && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Launch kit generation failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{launchError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={run}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Launch kit content */}
      {md && !running && (
        <div className="space-y-4">
          <LaunchToc md={md} />
          <div className="rounded-lg border border-border bg-background p-6">
            <MarkdownView md={md} />
          </div>
          <div className="flex items-center gap-3 border-t border-border pt-4">
            {isCompleted ? (
              <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-success">
                <Check className="h-4 w-4" />
                Project completed — congratulations!
              </div>
            ) : (
              <Button
                onClick={complete}
                disabled={completing}
                className="bg-gradient-electric text-primary-foreground shadow-glow"
              >
                {completing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Check className="h-4 w-4" />}
                Mark Project as Completed
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Placeholder for steps 2-5 ----------
function Placeholder({ step }: { step: { key: Status; label: string; icon: any; desc: string } }) {
  const Icon = step.icon;
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-3 text-lg font-semibold">{step.label}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{step.desc}</p>
      <Button disabled className="mt-5 opacity-50">Run {step.label}</Button>
      <div className="mt-3 text-xs uppercase tracking-widest text-primary/70">Building this step next</div>
    </div>
  );
}
