"use client";

import { CloudUpload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkbenchSaveButton({
  dirty,
  saving,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={!dirty || saving}
        onClick={() => void onSave()}
        title="保存到云端（⌘/Ctrl + S）"
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CloudUpload className="h-3.5 w-3.5" />
        )}
        {saving ? "处理中" : dirty ? "保存到云端" : "已保存"}
      </Button>
    </div>
  );
}
