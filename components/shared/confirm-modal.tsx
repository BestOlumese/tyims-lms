"use client";

import { Modal } from "./modal";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  /** Name of the record being deleted, shown so the admin sees exactly what goes. */
  confirmationText?: string;
  isLoading?: boolean;
  variant?: "danger" | "warning";
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmationText,
  isLoading,
  variant = "danger"
}: ConfirmModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-md">
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 bg-rose-50 rounded-2xl">
          <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-rose-900">Are you absolutely sure?</h3>
            <p className="text-[13px] text-rose-700/80 font-medium leading-relaxed mt-1">
              {description}
            </p>
            {confirmationText && (
              <p className="text-[13px] text-rose-900 font-bold mt-2 break-words">
                {confirmationText}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl text-[14px] font-bold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin" size={18} />}
            Confirm Delete
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-white border border-gray-100 text-gray-600 rounded-xl text-[14px] font-bold hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
