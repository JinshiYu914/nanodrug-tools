"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Scissors,
  Plus,
  Trash2,
  Folder,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  LogIn,
  Download,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import * as XLSX from "xlsx";

interface Fragment {
  id: string;
  name: string;
  size: string;
  concentration: string;
}

interface Enzyme {
  id: string;
  name: string;
  volume: string;
}

interface LigationResult {
  vectorVolume: number;
  fragments: { name: string; volume: number; moles: string }[];
  enzymes: { name: string; volume: number }[];
  waterVolume: number;
  totalVolume: number;
}

interface SavedRecord {
  id: string;
  name: string;
  folder_id: string | null;
  vector_info: Record<string, unknown>;
  fragments_info: Record<string, unknown>[];
  enzyme_info: Record<string, unknown>[];
  result_info: Record<string, unknown>;
  molar_ratio: number;
  total_volume: number;
  created_at: string;
}

interface SavedFolder {
  id: string;
  name: string;
  created_at: string;
}

let nextId = 1;
let nextEnzId = 1;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  const m = d.getMonth() + 1, day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) return `${m}/${day}`;
  return `${d.getFullYear().toString().slice(-2)}/${m}/${day}`;
}

export function LigationCalc() {
  const [vectorSize, setVectorSize] = useState("5000");
  const [vectorConc, setVectorConc] = useState("100");
  const [vectorAmount, setVectorAmount] = useState("100");
  const [molarRatio, setMolarRatio] = useState("3");
  const [totalVolume, setTotalVolume] = useState("20");
  const [fragments, setFragments] = useState<Fragment[]>([
    { id: "f1", name: "Insert 1", size: "1000", concentration: "50" },
  ]);
  const [enzymes, setEnzymes] = useState<Enzyme[]>([
    { id: "e1", name: "Recombinase (e.g. ClonExpress)", volume: "2" },
  ]);
  const [result, setResult] = useState<LigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveFolderId, setSaveFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [panelError, setPanelError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingType, setRenamingType] = useState<"folder" | "record" | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    return user?.id ?? null;
  }, [supabase]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setPanelError(null);
      const [fRes, rRes] = await Promise.all([
        supabase.from("ligation_folders").select("*").order("created_at"),
        supabase.from("ligation_records").select("*").order("created_at", { ascending: false }),
      ]);
      if (fRes.error) throw fRes.error;
      if (rRes.error) throw rRes.error;
      setFolders((fRes.data as SavedFolder[]) || []);
      setRecords((rRes.data as SavedRecord[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist") || msg.includes("42P01")) {
        setPanelError("数据表尚未创建，请运行 SQL 迁移");
      } else {
        setPanelError("加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    checkAuth().then((uid) => { if (uid) refresh(); });
  }, [checkAuth, refresh]);

  // ── Fragment / enzyme helpers ──
  function addFragment() {
    nextId++;
    setFragments((p) => [...p, { id: `f${nextId}`, name: `Insert ${p.length + 1}`, size: "", concentration: "" }]);
  }
  function removeFragment(id: string) { setFragments((p) => p.filter((f) => f.id !== id)); }
  function updateFragment(id: string, field: keyof Fragment, value: string) {
    setFragments((p) => p.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  }
  function addEnzyme() {
    nextEnzId++;
    setEnzymes((p) => [...p, { id: `e${nextEnzId}`, name: "", volume: "" }]);
  }
  function removeEnzyme(id: string) { setEnzymes((p) => p.filter((e) => e.id !== id)); }

  // ── Calculate ──
  function calculate() {
    setError(null); setResult(null);
    const vSize = parseFloat(vectorSize), vConc = parseFloat(vectorConc);
    const vAmount = parseFloat(vectorAmount), ratio = parseFloat(molarRatio);
    const total = parseFloat(totalVolume);
    if ([vSize, vConc, vAmount, ratio, total].some(isNaN)) { setError("请填写所有参数"); return; }

    const vectorVol = vAmount / vConc;
    const vectorMoles = (vAmount / (vSize * 660)) * 1e6;
    const fragResults: LigationResult["fragments"] = [];
    let totalFragVol = 0;

    for (const frag of fragments) {
      const fSize = parseFloat(frag.size), fConc = parseFloat(frag.concentration);
      if (isNaN(fSize) || isNaN(fConc) || fConc === 0) { setError(`请填写 ${frag.name} 的参数`); return; }
      const reqMoles = vectorMoles * ratio;
      const reqMass = (reqMoles * fSize * 660) / 1e6;
      const fragVol = reqMass / fConc;
      totalFragVol += fragVol;
      fragResults.push({ name: frag.name, volume: parseFloat(fragVol.toFixed(2)), moles: reqMoles.toFixed(2) + " fmol" });
    }

    const enzymeResults: LigationResult["enzymes"] = [];
    let totalEnzVol = 0;
    for (const enz of enzymes) {
      const v = parseFloat(enz.volume);
      if (!isNaN(v) && v > 0 && enz.name) {
        enzymeResults.push({ name: enz.name, volume: v });
        totalEnzVol += v;
      }
    }

    const usedVol = vectorVol + totalFragVol + totalEnzVol;
    const waterVol = Math.max(0, total - usedVol);
    if (usedVol > total) { setError(`总体积不足: 需 ${usedVol.toFixed(1)} µL > ${total} µL`); return; }

    setResult({
      vectorVolume: parseFloat(vectorVol.toFixed(2)),
      fragments: fragResults,
      enzymes: enzymeResults,
      waterVolume: parseFloat(waterVol.toFixed(2)),
      totalVolume: total,
    });
  }

  // ── Save / folder ──
  async function handleSave() {
    if (!userId || !saveName.trim()) return;
    try {
      setLoading(true);
      await supabase.from("ligation_records").insert({
        user_id: userId,
        folder_id: saveFolderId,
        name: saveName.trim(),
        vector_info: { size: vectorSize, concentration: vectorConc, amount: vectorAmount },
        fragments_info: fragments.map((f) => ({ name: f.name, size: f.size, concentration: f.concentration })),
        enzyme_info: enzymes.filter((e) => e.name && e.volume).map((e) => ({ name: e.name, volume: e.volume })),
        result_info: result ?? {},
        molar_ratio: parseFloat(molarRatio),
        total_volume: parseFloat(totalVolume),
      });
      setSaveName("");
      await refresh();
    } catch {
      setPanelError("保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFolder() {
    if (!userId || !newFolderName.trim()) return;
    try {
      await supabase.from("ligation_folders").insert({ user_id: userId, name: newFolderName.trim() });
      setNewFolderName("");
      setShowNewFolder(false);
      await refresh();
    } catch {
      setPanelError("创建文件夹失败");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`确定要删除「${name}」吗？`)) return;
    try {
      await supabase.from("ligation_records").delete().eq("id", id);
      await refresh();
    } catch { setPanelError("删除失败"); }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!window.confirm(`确定要删除文件夹「${name}」及其所有记录吗？`)) return;
    try {
      await supabase.from("ligation_records").delete().eq("folder_id", id);
      await supabase.from("ligation_folders").delete().eq("id", id);
      await refresh();
    } catch { setPanelError("删除失败"); }
  }

  // ── Rename ──
  function startRename(id: string, type: "folder" | "record", currentName: string) {
    setRenamingId(id);
    setRenamingType(type);
    setRenameValue(currentName);
  }

  async function confirmRename() {
    if (!renamingId || !renameValue.trim()) { cancelRename(); return; }
    try {
      const table = renamingType === "folder" ? "ligation_folders" : "ligation_records";
      await supabase.from(table).update({ name: renameValue.trim() }).eq("id", renamingId);
      cancelRename();
      await refresh();
    } catch { setPanelError("重命名失败"); }
  }

  function cancelRename() {
    setRenamingId(null);
    setRenamingType(null);
    setRenameValue("");
  }

  // ── Load record ──
  function loadRecord(rec: SavedRecord) {
    const vi = rec.vector_info as { size: string; concentration: string; amount: string };
    setVectorSize(vi.size);
    setVectorConc(vi.concentration);
    setVectorAmount(vi.amount);
    setMolarRatio(String(rec.molar_ratio));
    setTotalVolume(String(rec.total_volume));
    setFragments((rec.fragments_info as { name: string; size: string; concentration: string }[]).map((f, i) => ({ id: `loaded_${i}`, ...f })));
    const enzList = rec.enzyme_info as { name: string; volume: string }[];
    if (enzList.length > 0) {
      setEnzymes(enzList.map((e, i) => ({ id: `le_${i}`, ...e })));
    }
    setResult(null);
    setError(null);
  }

  // ── Excel export ──
  function handleExport() {
    if (records.length === 0) return;
    const wb = XLSX.utils.book_new();

    const summaryRows: Record<string, string | number>[] = [];
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const vi = rec.vector_info as { size?: string; concentration?: string; amount?: string };
      const frags = rec.fragments_info as { name?: string; size?: string; concentration?: string }[];
      const enzs = rec.enzyme_info as { name?: string; volume?: string }[];
      const folder = folders.find((f) => f.id === rec.folder_id);
      summaryRows.push({
        "#": i + 1,
        "记录名称": rec.name,
        "文件夹": folder?.name ?? "—",
        "载体大小 (bp)": vi.size ?? "",
        "载体浓度 (ng/µL)": vi.concentration ?? "",
        "载体用量 (ng)": vi.amount ?? "",
        "摩尔比 (Insert:Vector)": `${rec.molar_ratio}:1`,
        "总反应体积 (µL)": rec.total_volume,
        "片段数": frags.length,
        "酶/缓冲液": enzs.map((e) => `${e.name} ${e.volume}µL`).join("; "),
        "创建时间": new Date(rec.created_at).toLocaleString("zh-CN"),
      });
    }
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1["!cols"] = [
      { wch: 4 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "记录汇总");

    const detailRows: Record<string, string | number>[] = [];
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const vi = rec.vector_info as { size?: string; concentration?: string; amount?: string };
      const frags = rec.fragments_info as { name?: string; size?: string; concentration?: string }[];
      const enzs = rec.enzyme_info as { name?: string; volume?: string }[];
      const ri = rec.result_info as { result?: LigationResult };
      const res = ri?.result ?? (rec.result_info as unknown as LigationResult);

      detailRows.push({
        "记录名称": rec.name,
        "组分": "Vector",
        "名称": "Vector",
        "大小 (bp)": vi.size ?? "",
        "浓度 (ng/µL)": vi.concentration ?? "",
        "用量 (ng)": vi.amount ?? "",
        "吸取量 (µL)": res?.vectorVolume ?? "",
        "备注": "",
      });
      frags.forEach((f, fi) => {
        const fragRes = res?.fragments?.[fi];
        detailRows.push({
          "记录名称": rec.name,
          "组分": "Insert",
          "名称": f.name ?? `Insert ${fi + 1}`,
          "大小 (bp)": f.size ?? "",
          "浓度 (ng/µL)": f.concentration ?? "",
          "用量 (ng)": "",
          "吸取量 (µL)": fragRes?.volume ?? "",
          "备注": fragRes?.moles ?? "",
        });
      });
      enzs.forEach((e) => {
        detailRows.push({
          "记录名称": rec.name,
          "组分": "Enzyme/Buffer",
          "名称": e.name ?? "",
          "大小 (bp)": "",
          "浓度 (ng/µL)": "",
          "用量 (ng)": "",
          "吸取量 (µL)": e.volume ?? "",
          "备注": "",
        });
      });
      if (res?.waterVolume !== undefined) {
        detailRows.push({
          "记录名称": rec.name,
          "组分": "Water",
          "名称": "ddH₂O",
          "大小 (bp)": "",
          "浓度 (ng/µL)": "",
          "用量 (ng)": "",
          "吸取量 (µL)": res.waterVolume,
          "备注": "",
        });
      }
      if (i < records.length - 1) {
        detailRows.push({ "记录名称": "", "组分": "", "名称": "", "大小 (bp)": "", "浓度 (ng/µL)": "", "用量 (ng)": "", "吸取量 (µL)": "", "备注": "" });
      }
    }
    const ws2 = XLSX.utils.json_to_sheet(detailRows);
    ws2["!cols"] = [
      { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 10 },
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, "吸取方案明细");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ligation-records-${dateStr}.xlsx`);
  }

  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const recordsInFolder = (fid: string) => records.filter((r) => r.folder_id === fid);
  const unfiledRecords = records.filter((r) => !r.folder_id);

  // ── Inline rename input component ──
  function RenameInput() {
    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          className="h-5 text-[11px] flex-1 px-1"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") cancelRename(); }}
        />
        <button className="p-0.5 text-green-600 hover:text-green-700" onClick={confirmRename}><Check className="h-2.5 w-2.5" /></button>
        <button className="p-0.5 text-muted-foreground hover:text-destructive" onClick={cancelRename}><X className="h-2.5 w-2.5" /></button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-7">
      {/* ── Input Panel ── */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            <CardTitle>同源重组连接计算器</CardTitle>
          </div>
          <CardDescription>质量(ng) = 摩尔数(fmol) × 片段大小(bp) × 660 / 10⁶</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 1. Vector */}
          <div>
            <Label className="mb-2 block text-sm font-medium">载体 (Vector)</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">大小 (bp)</Label><Input type="number" value={vectorSize} onChange={(e) => setVectorSize(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">浓度 (ng/µL)</Label><Input type="number" value={vectorConc} onChange={(e) => setVectorConc(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">用量 (ng)</Label><Input type="number" value={vectorAmount} onChange={(e) => setVectorAmount(e.target.value)} /></div>
            </div>
          </div>

          {/* 2. Fragments */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-medium">目的片段 (Inserts)</Label>
              <Button size="sm" variant="outline" onClick={addFragment} className="gap-1 h-7 text-xs"><Plus className="h-3 w-3" /> 添加片段</Button>
            </div>
            {fragments.map((frag) => (
              <div key={frag.id} className="mb-2 flex items-end gap-2 rounded-lg border bg-muted/20 p-2.5">
                <div className="flex-1 grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">名称</Label><Input className="h-8 text-sm" value={frag.name} onChange={(e) => updateFragment(frag.id, "name", e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">大小 (bp)</Label><Input className="h-8 text-sm" type="number" value={frag.size} onChange={(e) => updateFragment(frag.id, "size", e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">浓度 (ng/µL)</Label><Input className="h-8 text-sm" type="number" value={frag.concentration} onChange={(e) => updateFragment(frag.id, "concentration", e.target.value)} /></div>
                </div>
                {fragments.length > 1 && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeFragment(frag.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            ))}
          </div>

          {/* 3. Molar ratio */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">摩尔比 (Insert:Vector)</Label>
            <Input type="number" step="0.5" value={molarRatio} onChange={(e) => setMolarRatio(e.target.value)} />
          </div>

          {/* 4. Enzymes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-medium">酶 / 缓冲液</Label>
              <Button size="sm" variant="outline" onClick={addEnzyme} className="gap-1 h-7 text-xs"><Plus className="h-3 w-3" /> 添加</Button>
            </div>
            {enzymes.map((enz) => (
              <div key={enz.id} className="mb-2 flex items-end gap-2 rounded-lg border bg-muted/20 p-2.5">
                <div className="flex-1 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">名称</Label><Input className="h-8 text-sm" value={enz.name} onChange={(e) => setEnzymes((p) => p.map((x) => x.id === enz.id ? { ...x, name: e.target.value } : x))} placeholder="e.g. ClonExpress II" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">体积 (µL)</Label><Input className="h-8 text-sm" type="number" value={enz.volume} onChange={(e) => setEnzymes((p) => p.map((x) => x.id === enz.id ? { ...x, volume: e.target.value } : x))} /></div>
                </div>
                {enzymes.length > 1 && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeEnzyme(enz.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            ))}
          </div>

          {/* 5. Total volume */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">总反应体积 (µL)</Label>
            <Input type="number" value={totalVolume} onChange={(e) => setTotalVolume(e.target.value)} />
          </div>

          {/* 6. Calculate */}
          <Button onClick={calculate} className="w-full">计算吸取量</Button>
        </CardContent>
      </Card>

      {/* ── Result Panel ── */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3"><CardTitle className="text-base">吸取方案</CardTitle></CardHeader>
        <CardContent>
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {result && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950/30">
                  <span className="font-medium">Vector</span>
                  <span className="font-mono font-bold">{result.vectorVolume} µL</span>
                </div>
                {result.fragments.map((f) => (
                  <div key={f.name} className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm dark:bg-green-950/30">
                    <div><span className="font-medium">{f.name}</span><span className="ml-1.5 text-xs text-muted-foreground">({f.moles})</span></div>
                    <span className="font-mono font-bold">{f.volume} µL</span>
                  </div>
                ))}
                {result.enzymes.map((e) => (
                  <div key={e.name} className="flex items-center justify-between rounded-md bg-purple-50 px-3 py-2 text-sm dark:bg-purple-950/30">
                    <span className="font-medium">{e.name}</span>
                    <span className="font-mono font-bold">{e.volume} µL</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span>ddH₂O</span>
                  <span className="font-mono font-medium">{result.waterVolume} µL</span>
                </div>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">总反应体积</span><span className="font-bold">{result.totalVolume} µL</span></div>
              </div>
              <p className="text-xs text-muted-foreground">Insert:Vector = {molarRatio}:1 摩尔比</p>
            </div>
          )}
          {!result && !error && <p className="py-8 text-center text-sm text-muted-foreground">输入参数后点击计算</p>}
        </CardContent>
      </Card>

      {/* ── Saved Records Panel ── */}
      <div className="lg:col-span-2">
        {!userId ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">实验记录</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-4 space-y-2">
                <LogIn className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">登录后可保存和管理实验记录</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-1">
                <CardTitle className="text-sm">实验记录</CardTitle>
                <button
                  onClick={handleExport}
                  disabled={records.length === 0}
                  className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
                  title="导出全部数据为 Excel"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Save input */}
              <div className="space-y-1.5">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="输入名称"
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                {folders.length > 0 && (
                  <select
                    value={saveFolderId ?? ""}
                    onChange={(e) => setSaveFolderId(e.target.value || null)}
                    className="flex h-6 w-full rounded-md border border-input bg-transparent px-2 py-0 text-[10px]"
                  >
                    <option value="">保存到根目录</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>📁 {f.name}</option>
                    ))}
                  </select>
                )}
                <Button
                  size="sm"
                  className="w-full h-6 text-[10px]"
                  onClick={handleSave}
                  disabled={loading || !saveName.trim()}
                >
                  保存当前配置
                </Button>
              </div>

              <Separator />

              {/* New folder */}
              {showNewFolder ? (
                <div className="flex gap-1">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="文件夹名称"
                    className="h-6 text-xs flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCreateFolder}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-[10px] justify-start gap-1"
                  onClick={() => setShowNewFolder(true)}
                >
                  <Plus className="h-3 w-3" /> 新建文件夹
                </Button>
              )}

              {panelError && <p className="text-[10px] text-destructive">{panelError}</p>}

              {/* Records tree */}
              <div className="space-y-0 max-h-72 overflow-y-auto rounded">
                {folders.map((folder) => (
                  <div key={folder.id}>
                    <div
                      className="flex items-center gap-0.5 rounded px-1 py-0.5 cursor-pointer group transition-colors hover:bg-muted"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      {expandedFolders.has(folder.id) ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      {expandedFolders.has(folder.id) ? <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" /> : <Folder className="h-3 w-3 shrink-0 text-amber-500" />}
                      {renamingId === folder.id ? (
                        <div className="flex-1 ml-0.5"><RenameInput /></div>
                      ) : (
                        <>
                          <span className="text-[11px] font-medium truncate flex-1 ml-0.5">{folder.name}</span>
                          <span className="text-[9px] text-muted-foreground shrink-0">{recordsInFolder(folder.id).length}</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                            onClick={(e) => { e.stopPropagation(); startRename(folder.id, "folder", folder.name); }}
                          ><Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-primary" /></button>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }}
                          ><Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" /></button>
                        </>
                      )}
                    </div>
                    {expandedFolders.has(folder.id) && recordsInFolder(folder.id).map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center gap-0.5 rounded px-1 py-[3px] cursor-pointer group transition-colors hover:bg-muted"
                        style={{ paddingLeft: 14 }}
                        onClick={() => { if (renamingId !== rec.id) loadRecord(rec); }}
                      >
                        <FileText className="h-3 w-3 shrink-0 text-blue-500 ml-0.5" />
                        {renamingId === rec.id ? (
                          <div className="flex-1 ml-0.5"><RenameInput /></div>
                        ) : (
                          <>
                            <span className="text-[11px] truncate flex-1 ml-0.5">{rec.name}</span>
                            <span className="text-[9px] text-muted-foreground shrink-0">{formatDate(rec.created_at)}</span>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                              onClick={(e) => { e.stopPropagation(); startRename(rec.id, "record", rec.name); }}
                            ><Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-primary" /></button>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                              onClick={(e) => { e.stopPropagation(); handleDelete(rec.id, rec.name); }}
                            ><Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" /></button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {unfiledRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-0.5 rounded px-1 py-[3px] cursor-pointer group transition-colors hover:bg-muted"
                    style={{ paddingLeft: 14 }}
                    onClick={() => { if (renamingId !== rec.id) loadRecord(rec); }}
                  >
                    <FileText className="h-3 w-3 shrink-0 text-blue-500 ml-0.5" />
                    {renamingId === rec.id ? (
                      <div className="flex-1 ml-0.5"><RenameInput /></div>
                    ) : (
                      <>
                        <span className="text-[11px] truncate flex-1 ml-0.5">{rec.name}</span>
                        <span className="text-[9px] text-muted-foreground shrink-0">{formatDate(rec.created_at)}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                          onClick={(e) => { e.stopPropagation(); startRename(rec.id, "record", rec.name); }}
                        ><Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-primary" /></button>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                          onClick={(e) => { e.stopPropagation(); handleDelete(rec.id, rec.name); }}
                        ><Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" /></button>
                      </>
                    )}
                  </div>
                ))}
                {records.length === 0 && !loading && (
                  <p className="text-[10px] text-muted-foreground text-center py-3">暂无保存的记录</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
