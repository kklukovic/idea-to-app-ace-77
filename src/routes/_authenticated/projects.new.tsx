import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/projects/new")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: u.user.id, name: "Untitled Project", status: "profile" })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create project");
    throw redirect({ to: "/projects/$id", params: { id: data.id } });
  },
});
