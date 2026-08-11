import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listKnowledge, registerKnowledgeFile, deleteKnowledgeFile, createKnowledgeUpload } from "@/lib/knowledge.functions";
import { listOrgs } from "@/lib/catalog.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, Trash2, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKnowledge);
  const regFn = useServerFn(registerKnowledgeFile);
  const delFn = useServerFn(deleteKnowledgeFile);
  const orgsFn = useServerFn(listOrgs);
  const startUploadFn = useServerFn(createKnowledgeUpload);

  const files = useQuery({ queryKey: ["knowledge"], queryFn: () => listFn() });
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: () => orgsFn() });
  const [orgId, setOrgId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["knowledge"] }); },
  });

  async function handleFiles(list: FileList | null) {
    if (!list || !list.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const { path, token } = await startUploadFn({ data: { filename: file.name } });
        const { error } = await supabase.storage
          .from("knowledge")
          .uploadToSignedUrl(path, token, file);
        if (error) throw error;
        await regFn({ data: {
          storage_path: path, filename: file.name, mime_type: file.type,
          size_bytes: file.size, organization_id: orgId || null,
        }});
      }
      toast.success(`Uploaded ${list.length} file(s)`);
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><FolderOpen className="h-7 w-7" /> Knowledge Vault</h1>
        <p className="text-muted-foreground">Drop contracts, customer lists, bank statements, pitch material. AI uses these as context every run.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium">Assign to organization (optional)</label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="Shared (both orgs)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Shared</SelectItem>
                  {(orgs.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading..." : "Upload files"}
            </Button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Files ({files.data?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(files.data ?? []).map((f) => (
              <div key={f.id} className="flex items-center justify-between border rounded p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{f.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {(f as { organizations?: { name?: string } }).organizations?.name ?? "Shared"} ·
                      {" "}{f.size_bytes ? `${Math.round(f.size_bytes / 1024)} KB` : ""} ·
                      {" "}{new Date(f.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!files.data?.length && <p className="text-sm text-muted-foreground">No files yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
