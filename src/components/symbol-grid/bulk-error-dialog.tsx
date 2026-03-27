import React from "react";

import { X, Layers, AlertTriangle } from "lucide-react";

export interface BulkErrorData {
  type: "overflow" | "quota";
  selected?: number;
  available?: number;
}

interface BulkErrorDialogProps {
  error: BulkErrorData | null;
  onClose: () => void;
}

export const BulkErrorDialog: React.FC<BulkErrorDialogProps> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {error.type === "quota" ? (
              <div className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/30">
                <AlertTriangle size={24} />
              </div>
            ) : (
              <div className="rounded-full bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/30">
                <Layers size={24} />
              </div>
            )}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {error.type === "quota" ? "Storage Limit Reached" : "Too Many Images"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800"
          >
            <X size={20} />
          </button>
        </div>

        {error.type === "quota" ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Your browser's storage limit for this site has been exceeded. This usually happens
              when uploading many high-resolution images at once.
            </p>
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 dark:border-red-900/20 dark:bg-red-950/20">
              <h4 className="mb-1 text-xs font-bold tracking-wider text-red-700 uppercase dark:text-red-400">
                How to fix:
              </h4>
              <ul className="list-inside list-disc space-y-1 text-xs text-red-600 dark:text-red-400/80">
                <li>Clear current symbols and try again</li>
                <li>Upload images in smaller batches</li>
                <li>Try using a different browser (e.g. Chrome) if the issue persists</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            You selected <span className="font-bold text-indigo-600">{error.selected}</span> images,
            but only <span className="font-bold text-indigo-600">{error.available}</span> slot
            {error.available !== 1 ? "s" : ""} remain. Please select fewer images or clear some
            slots first.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white transition-all hover:bg-indigo-700 active:scale-[0.98]"
        >
          Understand
        </button>
      </div>
    </div>
  );
};
