"use client";

import { useState } from "react";

export function UploadZone({
  fileName,
  inputId,
  onFile,
}: {
  fileName: string | null;
  inputId: string;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`rounded-[20px] border border-dashed transition duration-200 ${
        fileName ? "border-success/40 bg-success/5" : dragging ? "border-accent bg-accent/5" : "border-line bg-card hover:border-accent/50"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <label
        htmlFor={inputId}
        className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 px-6 py-10 text-center"
      >
        {fileName ? (
          <>
            <span className="text-sm font-medium text-success">Resume added</span>
            <span className="max-w-full truncate text-lg font-medium">{fileName}</span>
            <span className="text-sm text-muted">PDF ready. Choose another file to replace it.</span>
          </>
        ) : (
          <>
            <span className="text-lg font-medium">Drag your resume here</span>
            <span className="text-sm text-muted">or choose a PDF</span>
          </>
        )}
      </label>
    </div>
  );
}
