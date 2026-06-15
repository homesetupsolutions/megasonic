import { createFileRoute, useServerFn } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createIdea, deleteIdea, listIdeas, listProjects, updateIdeaStage } from "@/lib/hub.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STAGES = ["idea", "validating", "building", "launched"] as const;

export const Route = createFileRoute("/_authenticated/ideas")({
  component: IdeasPage,
});

function IdeasPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listIdeas);
  const projFn = useServerFn(listProjects);
  const createFn = useServerFn(createIdea);
  const stageFn = useServerFn(updateIdeaStage);
  const delFn = useServerFn(deleteIdea);

  const { data: ideas } = useQuery({ queryKey: ["ideas"], queryFn: () => listFn() });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: () => projFn() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [projectId, setProjectId] = useState<string>("none");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title,
          body: body || undefined,
          project_id: projectId === "none" ? null : projectId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setTitle("");
      setBody("");
      toast.success("Idea captured");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStage = useMutation({
    mutationFn: (v: { id: string; stage: string }) => stageFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Ideas</h1>
        <p className="text-muted-foreground">Brain dump now, sort later. Tag to a project to track who it belongs to.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Input placeholder="Idea title…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Details (optional)" value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
          <div className="flex gap-2">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!title || create.isPending} onClick={() => create.mutate()}>
              <Plus className="h-4 w-4 mr-2" /> Capture
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-3">
        {STAGES.map((stage) => (
          <div key={stage} className="space-y-2">
            <h3 className="text-sm font-semibold capitalize text-muted-foreground">{stage}</h3>
            {ideas?.filter((i: any) => i.stage === stage).map((i: any) => (
              <Card key={i.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{i.title}</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => del.mutate(i.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {i.body && <p className="text-xs text-muted-foreground line-clamp-3">{i.body}</p>}
                  <div className="flex items-center gap-2">
                    {i.linked_projects && (
                      <Badge variant="outline" style={{ borderColor: i.linked_projects.color }}>
                        {i.linked_projects.name}
                      </Badge>
                    )}
                    <Select value={i.stage} onValueChange={(v) => setStage.mutate({ id: i.id, stage: v })}>
                      <SelectTrigger className="h-7 text-xs ml-auto w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
