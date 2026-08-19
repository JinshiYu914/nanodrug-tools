"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function WorkbenchSwitchDialog({
  targetName,
  saving,
  onCancel,
  onKeepDraftAndSwitch,
  onSaveAndSwitch,
}: {
  targetName: string | null;
  saving: boolean;
  onCancel: () => void;
  onKeepDraftAndSwitch: () => void;
  onSaveAndSwitch: () => Promise<void>;
}) {
  return (
    <Dialog open={targetName !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>当前实验有未保存修改</DialogTitle>
          <DialogDescription>
            切换到“{targetName}”前，请选择如何处理当前本机草稿。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:flex-wrap">
          <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
            取消
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onKeepDraftAndSwitch}
          >
            保留本机草稿并切换
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={saving}
            onClick={() => void onSaveAndSwitch()}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "正在保存" : "保存并切换"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
