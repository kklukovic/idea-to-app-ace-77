import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateIdeas, scoreIdeas, generateBlueprint, generateLaunchPlan, saveProfile, markCompleted, type Idea, type ScoredIdea } from "@/lib/zita.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Target, Sparkles, Zap, FileCode, Rocket, Loader2, Copy, Download, Check, CheckCircle2, ChevronDown, ChevronUp, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("projects").select("*").eq("id", params.id).single();
    if (error || !data) throw notFound();
    return { project: data };
  },
  component: Workspace,
});

type Status = "profile" | "discover" | "score" | "blueprint" | "launch" | "completed";
const STEP_ORDER: Status[] = ["profile", "discover", "score", "blueprint", "launch"];
const stepIndex = (s: string) => Math.max(0, STEP_ORDER.indexOf(s as Status));

function Workspace() {
  const { project: initial } = Route.useLoaderData();
  const qc = useQueryClient();
  const { data: project } = useQuery({
    queryKey: ["project", initial.id],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", initial.id).single()).data!,
    initialData: initial,
  });

  const reachable = stepIndex(project.status);
  const [tab, setTab] = useState<Status>(project.status as Status === "completed" ? "launch" : (project.status as Status));

  const refresh = () => qc.invalidateQueries({ queryKey: ["project", initial.id] });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary">Project</div>
          <h1 className="mt-1 text-2xl font-bold">{project.name}</h1>
        </div>
        <div className="text-xs text-muted-foreground">Step {Math.min(reachable + 1, 5)} of 5</div>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-accent">
        <div className="h-full bg-gradient-electric transition-all duration-500" style={{ width: `${((reachable + (project.status === "completed" ? 1 : 0)) / 5) * 100}%` }} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList className="grid h-auto w-full grid-cols-5 bg-card p-1">
          {([
            { v: "profile", icon: Target, label: "Profile" },
            { v: "discover", icon: Sparkles, label: "Discover" },
            { v: "score", icon: Zap, label: "Score" },
            { v: "blueprint", icon: FileCode, label: "Blueprint" },
            { v: "launch", icon: Rocket, label: "Launch" },
          ] as const).map((t, i) => {
            const locked = i > reachable;
            return (
              <TabsTrigger key={t.v} value={t.v} disabled={locked} className="flex flex-col gap-1 py-2 data-[state=active]:bg-gradient-electric data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow">
                <t.icon className="h-4 w-4" />
                <span className="text-xs">{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab project={project} onSaved={() => { refresh(); setTab("discover"); }} />
        </TabsContent>
        <TabsContent value="discover" className="mt-6">
          <DiscoverTab project={project} onDone={() => { refresh(); setTab("score"); }} />
        </TabsContent>
        <TabsContent value="score" className="mt-6">
          <ScoreTab project={project} onDone={() => { refresh(); setTab("blueprint"); }} />
        </TabsContent>
        <TabsContent value="blueprint" className="mt-6">
          <BlueprintTab project={project} onDone={() => { refresh(); setTab("launch"); }} />
        </TabsContent>
        <TabsContent value="launch" className="mt-6">
          <LaunchTab project={project} onDone={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------- TAB 1: PROFILE -------
function ProfileTab({ project, onSaved }: { project: any; onSaved: () => void }) {
  const save = useServerFn(saveProfile);
  const existing = (project.profile_data ?? {}) as Record<string, string>;
  const [name, setName] = useState(project.name === "Untitled Project" ? "" : project.name);
  const [form, setForm] = useState({
    expertise: existing.expertise ?? "",
    audience: existing.audience ?? "",
    offer: existing.offer ?? "",
    topic: existing.topic ?? "",
    tool_type: existing.tool_type ?? "Not sure yet",
    skill_level: existing.skill_level ?? "Beginner",
    time_per_week: existing.time_per_week ?? "5-10h",
  });
  const [manual, setManual] = useState<string>(project.manual_research ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: { projectId: project.id, profile: form, manual_research: manual, name: name || undefined } });
      toast.success("Profile saved");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-card">
      <Field label="Project name (optional)"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recipe macro tracker" /></Field>
      <Field label="What do you do?"><Textarea required value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} placeholder="Your expertise / background" rows={2} /></Field>
      <Field label="Who do you help?"><Input required value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Target audience" /></Field>
      <Field label="What do you sell or want to sell?"><Textarea required value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="Your current or planned offer" rows={2} /></Field>
      <Field label="Problem area or niche (optional)"><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Tool type">
          <Select value={form.tool_type} onChange={(v) => setForm({ ...form, tool_type: v })} options={["Lead magnet", "Paid mini-tool", "Client tool", "Internal business tool", "Not sure yet"]} />
        </Field>
        <Field label="Build skill">
          <Select value={form.skill_level} onChange={(v) => setForm({ ...form, skill_level: v })} options={["Beginner", "Intermediate", "Advanced"]} />
        </Field>
        <Field label="Time / week">
          <Select value={form.time_per_week} onChange={(v) => setForm({ ...form, time_per_week: v })} options={["<5h", "5-10h", "10-20h", "20+h"]} />
        </Field>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Info className="h-4 w-4 text-primary" />Manual Research (optional)</div>
        <p className="mb-3 text-xs text-muted-foreground">Live Reddit and YouTube research will be added later. For now, paste any research notes or use Fast AI Mode.</p>
        <Textarea value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste research notes here — Reddit threads, YouTube comments, Facebook groups, customer calls, emails… Anything raw works." rows={6} />
      </div>

      <Button type="submit" disabled={saving} className="bg-gradient-electric text-primary-foreground shadow-glow">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save & continue → Discover Ideas <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
      {options.map((o) => <option key={o} value={o} className="bg-background">{o}</option>)}
    </select>
  );
}

// ------- TAB 2: DISCOVER -------
function DiscoverTab({ project, onDone }: { project: any; onDone: () => void }) {
  const run = useServerFn(generateIdeas);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const ideas: Idea[] = project.ideas ?? [];

  const go = async () => {
    setLoading(true);
    try {
      await run({ data: { projectId: project.id } });
      toast.success("Ideas generated (8 credits)");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  if (ideas.length === 0) {
    return (
      <EmptyAction
        title="Discover real problems for your niche"
        desc={project.manual_research ? "Using your pasted research notes + Fast AI." : "Fast AI Mode (no manual research)."}
        cost={8}
        onRun={go}
        loading={loading}
        cta="Generate ideas"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{ideas.length} ideas — expand each to see evidence + monetization</div>
        <Button variant="outline" size="sm" onClick={go} disabled={loading}>{loading && <Loader2 className="h-3 w-3 animate-spin" />}Re-generate (8 cr)</Button>
      </div>
      {ideas.map((idea, i) => (
        <div key={i} className="rounded-xl border border-border bg-card shadow-card">
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-start justify-between gap-4 p-5 text-left">
            <div>
              <div className="font-semibold">{idea.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{idea.promise}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs">⚡ {idea.build_difficulty_1_10}/10</span>
              {open === i ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>
          {open === i && (
            <div className="space-y-3 border-t border-border p-5 text-sm">
              <Row label="Problem">{idea.problem}</Row>
              <Row label="Evidence"><em className="text-muted-foreground">"{idea.evidence}"</em></Row>
              <Row label="Target user">{idea.target_user}</Row>
              <Row label="Why they care">{idea.why_they_care}</Row>
              <Row label="Frequency">{idea.usage_frequency}</Row>
              <Row label="Monetization">{idea.monetization_angle}</Row>
              <Row label="Content angle">{idea.content_angle}</Row>
            </div>
          )}
        </div>
      ))}
      <Button onClick={onDone} className="bg-gradient-electric text-primary-foreground shadow-glow">Score these ideas <ArrowRight className="h-4 w-4" /></Button>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[110px_1fr] gap-3"><span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span><span>{children}</span></div>;
}

// ------- TAB 3: SCORE -------
function ScoreTab({ project, onDone }: { project: any; onDone: () => void }) {
  const run = useServerFn(scoreIdeas);
  const blueprint = useServerFn(generateBlueprint);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const scored: ScoredIdea[] = project.scored_ideas ?? [];

  const go = async () => {
    setLoading(true);
    try {
      await run({ data: { projectId: project.id } });
      toast.success("Ideas scored (4 credits)");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const choose = async (name: string) => {
    setPicking(name);
    try {
      await blueprint({ data: { projectId: project.id, chosenIdeaName: name } });
      toast.success("Blueprint generated (10 credits)");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setPicking(null); }
  };

  if (scored.length === 0) {
    return <EmptyAction title="Score every idea across 6 dimensions" desc="ZITA ranks ideas by pain, ease, monetization, content, conversation, and founder-offer fit." cost={4} onRun={go} loading={loading} cta="Score ideas" />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-accent/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">#</th><th className="px-4 py-3">Idea</th>
              {["Pain", "Ease", "$$", "Content", "Convo", "Founder"].map(h => <th key={h} className="px-2 py-3 text-center">{h}</th>)}
              <th className="px-4 py-3 text-center">Total</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {scored.map((s, i) => (
              <tr key={s.name} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3"><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.verdict}</div></td>
                <td className="px-2 py-3 text-center font-mono">{s.scores.pain_level}</td>
                <td className="px-2 py-3 text-center font-mono">{s.scores.build_ease}</td>
                <td className="px-2 py-3 text-center font-mono">{s.scores.monetization_potential}</td>
                <td className="px-2 py-3 text-center font-mono">{s.scores.content_potential}</td>
                <td className="px-2 py-3 text-center font-mono">{s.scores.conversation_potential}</td>
                <td className="px-2 py-3 text-center font-mono">{s.scores.founder_offer_potential}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-gradient-electric">{s.total}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" disabled={picking !== null} onClick={() => choose(s.name)} className={cn(i === 0 && "bg-gradient-electric text-primary-foreground shadow-glow")}>
                    {picking === s.name ? <Loader2 className="h-3 w-3 animate-spin" /> : null}Choose
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground">Choosing an idea triggers blueprint generation (10 credits).</div>
    </div>
  );
}

// ------- TAB 4: BLUEPRINT -------
function BlueprintTab({ project, onDone }: { project: any; onDone: () => void }) {
  const run = useServerFn(generateLaunchPlan);
  const regen = useServerFn(generateBlueprint);
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const md: string = project.blueprint_markdown ?? "";
  const idea = project.chosen_idea;

  if (!md) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Pick an idea in the Score tab to generate the blueprint.</div>;

  const promptMatch = md.match(/## Lovable Build Prompt\s*```([\s\S]*?)```/);
  const buildPrompt = promptMatch ? promptMatch[1].trim() : "";

  const go = async () => {
    setLoading(true);
    try { await run({ data: { projectId: project.id } }); toast.success("Launch plan generated (8 credits)"); onDone(); }
    catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  const reGen = async () => {
    if (!idea?.name) return;
    setRegenLoading(true);
    try { await regen({ data: { projectId: project.id, chosenIdeaName: idea.name } }); toast.success("Blueprint regenerated (10 credits)"); }
    catch (e: any) { toast.error(e.message); } finally { setRegenLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CopyBtn text={md} label="Copy PRD" />
        {buildPrompt && <CopyBtn text={buildPrompt} label="Copy Lovable prompt" variant="default" />}
        <DownloadBtn text={md} filename={`${project.name}-blueprint.md`} />
        <Button variant="outline" size="sm" onClick={reGen} disabled={regenLoading}>{regenLoading && <Loader2 className="h-3 w-3 animate-spin" />}Regenerate (10 cr)</Button>
      </div>
      <Markdown md={md} />
      <Button onClick={go} disabled={loading} className="bg-gradient-electric text-primary-foreground shadow-glow">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}Create launch plan (8 cr) <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ------- TAB 5: LAUNCH -------
function LaunchTab({ project, onDone }: { project: any; onDone: () => void }) {
  const md: string = project.launch_kit_markdown ?? "";
  const regen = useServerFn(generateLaunchPlan);
  const mark = useServerFn(markCompleted);
  const [loading, setLoading] = useState(false);

  if (!md) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Finish the blueprint step first.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CopyBtn text={md} label="Copy all" />
        <DownloadBtn text={md} filename={`${project.name}-launch.md`} />
        <Button variant="outline" size="sm" onClick={async () => {
          setLoading(true);
          try { await regen({ data: { projectId: project.id } }); toast.success("Re-generated (8 cr)"); }
          catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
        }} disabled={loading}>{loading && <Loader2 className="h-3 w-3 animate-spin" />}Re-generate (8 cr)</Button>
        {project.status !== "completed" && (
          <Button size="sm" onClick={async () => { await mark({ data: { projectId: project.id } }); toast.success("Marked as launched 🚀"); onDone(); }} className="bg-success/20 text-success hover:bg-success/30">
            <CheckCircle2 className="h-4 w-4" />Mark as launched
          </Button>
        )}
      </div>
      <Markdown md={md} />
    </div>
  );
}

// ------- Shared -------
function EmptyAction({ title, desc, cost, onRun, loading, cta }: { title: string; desc: string; cost: number; onRun: () => void; loading: boolean; cta: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{desc}</p>
      <Button onClick={onRun} disabled={loading} size="lg" className="mt-6 bg-gradient-electric text-primary-foreground shadow-glow">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {cta} <span className="ml-1 rounded-full bg-black/20 px-2 py-0.5 text-xs">{cost} cr</span>
      </Button>
      {loading && <div className="mt-3 text-xs text-muted-foreground">This usually takes 15-30 seconds…</div>}
    </div>
  );
}

function CopyBtn({ text, label, variant = "outline" }: { text: string; label: string; variant?: "outline" | "default" }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant={variant} onClick={async () => {
      await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500);
    }} className={variant === "default" ? "bg-gradient-electric text-primary-foreground" : ""}>
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{label}
    </Button>
  );
}
function DownloadBtn({ text, filename }: { text: string; filename: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => {
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }}><Download className="h-3 w-3" />Download .md</Button>
  );
}

// Minimal markdown renderer (headings, code, paragraphs, lists)
function Markdown({ md }: { md: string }) {
  const html = renderMd(md);
  return <div className="prose-zita rounded-xl border border-border bg-card p-6 shadow-card" dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderMd(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = src.split("\n");
  let out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  for (const raw of lines) {
    if (raw.startsWith("```")) {
      if (inCode) { out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`); codeBuf = []; inCode = false; }
      else { closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    if (/^### /.test(raw)) { closeList(); out.push(`<h3>${inline(raw.slice(4))}</h3>`); continue; }
    if (/^## /.test(raw)) { closeList(); out.push(`<h2>${inline(raw.slice(3))}</h2>`); continue; }
    if (/^# /.test(raw)) { closeList(); out.push(`<h1>${inline(raw.slice(2))}</h1>`); continue; }
    if (/^\s*[-*]\s+/.test(raw)) {
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inline(raw.replace(/^\s*[-*]\s+/, ""))}</li>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(raw)) {
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inline(raw.replace(/^\s*\d+\.\s+/, ""))}</li>`); continue;
    }
    if (raw.trim() === "") { closeList(); out.push(""); continue; }
    closeList();
    out.push(`<p>${inline(raw)}</p>`);
  }
  closeList();
  return out.join("\n");
  function inline(s: string) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
}

useEffect; // keep import for future
