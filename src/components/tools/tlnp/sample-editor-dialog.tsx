"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FormulationWorkspace, {
  type WorkspaceValue,
} from "@/components/tools/lnp/formulation-workspace";
import { createDefaultMethod } from "@/lib/calculations/lnp-bench";
import type { TlnpPrepSample } from "@/lib/calculations/tlnp-experiment";

/**
 * A TlnpPrepSample IS a BenchFormulation, so these two conversions are nearly
 * identity — they exist only because WorkspaceValue carries transient editor
 * state (targetVolume, the two normal-mode toggles) that the notebook has no
 * reason to persist.
 *
 * They live here rather than in tlnp-experiment.ts on purpose: WorkspaceValue
 * is a component-layer type, and the calculation layer must stay React-free.
 */
export function benchToWorkspace(s: TlnpPrepSample): WorkspaceValue {
  return {
    lipidEntries: s.lipidEntries.map((e) => ({ ...e })),
    targetVolume: "",
    volumeUnit: "uL",
    prep: { ...s.prep },
    method: s.method ? { ...s.method } : createDefaultMethod(),
  };
}

export function workspaceToBench(
  prev: TlnpPrepSample,
  name: string,
  ws: WorkspaceValue
): TlnpPrepSample {
  return {
    ...prev,
    name: name.trim() || prev.name,
    lipidEntries: ws.lipidEntries.map((e) => ({ ...e })),
    prep: { ...ws.prep },
    method: ws.method ? { ...ws.method } : prev.method,
  };
}

interface Props {
  sample: TlnpPrepSample | null;
  onClose: () => void;
  onSave: (next: TlnpPrepSample) => void;
}

/**
 * Full editor for one sample. Mounts FormulationWorkspace in screening mode so
 * the lipid picker, custom lipids, MW lookup, prep params and MethodPicker all
 * come along unchanged — the sample table only edits molar ratios, this is
 * where everything else is set.
 *
 * Edits are held locally and committed on 保存, so a cancelled dialog leaves
 * the batch untouched (and doesn't churn the autosave).
 */
export default function SampleEditorDialog({ sample, onClose, onSave }: Props) {
  if (!sample) return null;
  // Keyed so opening a different sample remounts with fresh state, rather than
  // syncing props into state through an effect.
  return (
    <Editor key={sample.id} sample={sample} onClose={onClose} onSave={onSave} />
  );
}

function Editor({
  sample,
  onClose,
  onSave,
}: {
  sample: TlnpPrepSample;
  onClose: () => void;
  onSave: (next: TlnpPrepSample) => void;
}) {
  const [draft, setDraft] = useState<WorkspaceValue>(() =>
    benchToWorkspace(sample)
  );
  const [name, setName] = useState(sample.name);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>编辑样品</DialogTitle>
          <DialogDescription>
            调整脂质组成、分子量、母液浓度与制备参数。摩尔比也可以直接在样品表里改。
          </DialogDescription>
        </DialogHeader>

        <FormulationWorkspace
          mode="screening"
          value={draft}
          onChange={(updater) => setDraft(updater)}
          formulationName={name}
          onFormulationNameChange={setName}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSave(workspaceToBench(sample, name, draft))}>
            保存样品
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
