"use client";

import { Upload } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/shared/lib/utils";
import { notify } from "@/shared/ui/sonner";
import { ACCEPTED_PHOTO_TYPES, planPhotoDrop } from "../model/photo-drop";

/**
 * Drop target and picker for listing photos. Rejections and over-cap files
 * are toasted here; `onFiles` only ever gets files that should upload.
 * `existing` is how many photos the listing already has.
 */
export function PhotoDropzone({
  existing,
  onFiles,
  disabled,
}: {
  existing: number;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_PHOTO_TYPES,
    disabled,
    onDrop: (accepted, rejections) => {
      const { upload, errors } = planPhotoDrop(
        accepted,
        rejections.map(({ file }) => file.name),
        existing,
      );
      for (const message of errors) notify.error(message);
      if (upload.length > 0) onFiles(upload);
    },
  });
  return (
    <div
      {...getRootProps({ role: "button", "aria-label": "Adicionar fotos" })}
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-5 py-4 text-sm font-semibold text-ink-soft hover:text-ink focus-visible:outline-3 focus-visible:outline-focus",
        isDragActive && "border-ink bg-paper text-ink",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input {...getInputProps()} />
      <Upload className="size-4" aria-hidden="true" />
      Arraste fotos aqui ou clique para adicionar
    </div>
  );
}
