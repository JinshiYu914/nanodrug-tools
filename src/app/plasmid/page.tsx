"use client";

import { useEffect, useState, useCallback } from "react";
import { Dna, Plus, Trash2, Edit, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { Plasmid, PlasmidFormData } from "@/types/plasmid";

const emptyForm: PlasmidFormData = {
  name: "",
  description: "",
  sequence: "",
  vector_type: "",
  resistance: "",
};

export default function PlasmidPage() {
  const [plasmids, setPlasmids] = useState<Plasmid[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PlasmidFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Plasmid | null>(null);

  const supabase = createClient();

  const fetchPlasmids = useCallback(async () => {
    const { data } = await supabase
      .from("plasmids")
      .select("*")
      .order("created_at", { ascending: false });
    setPlasmids(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPlasmids();
  }, [fetchPlasmids]);

  async function handleSave() {
    setSaving(true);
    const size_bp = formData.sequence
      ? formData.sequence.replace(/\s/g, "").length
      : null;

    if (editingId) {
      await supabase
        .from("plasmids")
        .update({
          name: formData.name,
          description: formData.description || null,
          sequence: formData.sequence || null,
          vector_type: formData.vector_type || null,
          resistance: formData.resistance || null,
          size_bp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("plasmids").insert({
        user_id: user.id,
        name: formData.name,
        description: formData.description || null,
        sequence: formData.sequence || null,
        vector_type: formData.vector_type || null,
        resistance: formData.resistance || null,
        size_bp,
      });
    }

    setDialogOpen(false);
    setFormData(emptyForm);
    setEditingId(null);
    setSaving(false);
    fetchPlasmids();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this plasmid?")) return;
    await supabase.from("plasmids").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    fetchPlasmids();
  }

  function handleEdit(plasmid: Plasmid) {
    setFormData({
      name: plasmid.name,
      description: plasmid.description || "",
      sequence: plasmid.sequence || "",
      vector_type: plasmid.vector_type || "",
      resistance: plasmid.resistance || "",
    });
    setEditingId(plasmid.id);
    setDialogOpen(true);
  }

  function handleNewPlasmid() {
    setFormData(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  }

  const filtered = plasmids.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Dna className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Plasmid Manager
            </h1>
          </div>
          <p className="text-muted-foreground">
            Store and organize your plasmid sequences
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewPlasmid} className="gap-2">
              <Plus className="h-4 w-4" /> New Plasmid
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Plasmid" : "Add New Plasmid"}
              </DialogTitle>
              <DialogDescription>
                Enter plasmid information below. Sequence field accepts raw
                nucleotide sequences.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="e.g. pCMV-GFP"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vector Type</Label>
                  <Input
                    placeholder="e.g. Expression, Cloning"
                    value={formData.vector_type}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        vector_type: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resistance</Label>
                <Input
                  placeholder="e.g. Ampicillin, Kanamycin"
                  value={formData.resistance}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, resistance: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of this plasmid"
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Sequence{" "}
                  {formData.sequence && (
                    <span className="text-xs text-muted-foreground">
                      ({formData.sequence.replace(/\s/g, "").length} bp)
                    </span>
                  )}
                </Label>
                <Textarea
                  placeholder="Paste nucleotide sequence here (ATCG...)"
                  rows={6}
                  className="font-mono text-xs"
                  value={formData.sequence}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, sequence: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name.trim() || saving}
              >
                {saving ? "Saving..." : editingId ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search plasmids..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          {plasmids.length === 0
            ? 'No plasmids yet. Click "New Plasmid" to add one.'
            : "No plasmids match your search."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((plasmid) => (
            <Card
              key={plasmid.id}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                selected?.id === plasmid.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelected(plasmid)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{plasmid.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(plasmid);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(plasmid.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {plasmid.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {plasmid.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {plasmid.size_bp && (
                    <Badge variant="secondary" className="text-xs">
                      {plasmid.size_bp.toLocaleString()} bp
                    </Badge>
                  )}
                  {plasmid.vector_type && (
                    <Badge variant="outline" className="text-xs">
                      {plasmid.vector_type}
                    </Badge>
                  )}
                  {plasmid.resistance && (
                    <Badge variant="outline" className="text-xs">
                      {plasmid.resistance}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sequence Viewer */}
      {selected && selected.sequence && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">
              Sequence: {selected.name}
              {selected.size_bp && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({selected.size_bp.toLocaleString()} bp)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
              {selected.sequence}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
