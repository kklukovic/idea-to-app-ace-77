import { createFileRoute } from "@tanstack/react-router";
import { Copy, Check, BookOpen, MessageCircle, Mail, Youtube, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/library")({
  component: Library,
});

const SECTIONS = [
  {
    id: "reddit", icon: Search, title: "Reddit Research Prompts",
    desc: "Drop into Reddit search or ChatGPT to mine pain.",
    items: [
      "site:reddit.com {audience} \"i wish there was\" OR \"i need a tool\" OR \"is there an app\"",
      "site:reddit.com {audience} \"frustrated\" OR \"can't find\" OR \"why is there no\"",
      "Find the top 10 most upvoted threads from r/{subreddit} in the last year that describe a specific repeating workflow pain. For each, extract: pain, attempted workarounds, what they'd pay for.",
    ],
  },
  {
    id: "yt", icon: Youtube, title: "YouTube Comment Mining Prompts",
    desc: "Paste a transcript or comments block into ChatGPT.",
    items: [
      "From these YouTube comments, extract every repeating complaint, workaround, and unmet desire. Group by theme. Quote the exact comment for each.",
      "From this transcript, identify every micro-tool the creator manually does that could be automated by a $19-47 web app.",
    ],
  },
  {
    id: "email", icon: Mail, title: "Email Launch Sequences (3 templates)",
    desc: "Three founder-tested launch emails. Replace {tool}, {price}, {limit}.",
    items: [
      "Email 1 — Launch day:\nSubject: I'm building {tool} live (founder access $47)\n\nFor the next 7 days I'm building {tool} in public. {one-line promise}. Founder access locked at $47 (will go to $97 once v1 ships). Limited to {limit} seats. Reply LIVE for the link.",
      "Email 2 — Day 3 / objection handling:\nSubject: \"But will it actually work?\"\n\nThree founders asked the same question yesterday. Here's the honest answer: {short answer}. The founder seats are filling up — {X} left. {link}",
      "Email 3 — Day 6 / scarcity:\nSubject: Final 24h on founder pricing\n\n{tool} goes to $97 tomorrow. {N} founder seats left. Here's what you get: {bullets}. {link}",
    ],
  },
  {
    id: "checklist", icon: BookOpen, title: "Manual Research Checklist",
    desc: "When you can't (yet) automate research, do this.",
    items: [
      "1. Pick 3 subreddits + 3 Facebook groups your audience lives in.",
      "2. Sort by Top → Year. Open the 10 highest-engagement posts.",
      "3. For each post, copy the title + top 3 comments into one document.",
      "4. Find 2 YouTube creators serving your audience. Paste 50+ comments from a relevant video into the document.",
      "5. Add 3-5 customer calls / DMs / support emails (paraphrased, no PII).",
      "6. Paste the whole document into the Discover tab → Manual Research textarea.",
    ],
  },
  {
    id: "convo", icon: MessageCircle, title: "DM Conversation Starters",
    desc: "Founder-tested openers that don't feel salesy.",
    items: [
      "Hey {name} — saw your comment on {post}. I'm building a tiny tool for {pain}. 2-min question: what would you pay for if it solved {pain} in under 5 min?",
      "Quick question — you mentioned {pain} in {place}. I'm researching tools for this. What's your current workaround?",
    ],
  },
];

function Library() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <div className="text-xs uppercase tracking-widest text-primary">Growth Library</div>
        <h1 className="mt-1 text-3xl font-bold">Prompts, templates, checklists</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live Reddit + YouTube research is coming. Until then, these prompts let you mine the same data manually in minutes.</p>
      </div>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent"><s.icon className="h-4 w-4 text-primary" /></div>
              <div className="flex-1">
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {s.items.map((it, i) => <Copyable key={i} text={it} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Copyable({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="group relative rounded-lg border border-border bg-background/50 p-3 pr-12 font-mono text-xs text-muted-foreground">
      <pre className="whitespace-pre-wrap">{text}</pre>
      <Button size="sm" variant="ghost" className="absolute right-1 top-1 h-7 w-7 p-0" onClick={async () => {
        await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500);
      }}>{done ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}</Button>
    </div>
  );
}
