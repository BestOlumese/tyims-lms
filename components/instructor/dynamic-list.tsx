"use client";

import { useState } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DynamicListProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  label: string;
}

export const DynamicList = ({ items = [], onChange, placeholder, label }: DynamicListProps) => {
  const [inputValue, setInputValue] = useState("");

  const addItem = () => {
    if (!inputValue.trim()) return;
    onChange([...items, inputValue.trim()]);
    setInputValue("");
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between ml-1">
        <label className="text-[13px] font-bold text-gray-700">{label}</label>
        <span className="text-[11px] text-gray-400 font-medium">{items.length} items added</span>
      </div>
      
      <div className="space-y-2">
        {items.map((item, index) => (
          <div 
            key={index} 
            className="group flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl animate-in slide-in-from-left-2 duration-300"
          >
            <GripVertical size={16} className="text-gray-300" />
            <span className="flex-1 text-[13px] font-medium text-gray-600">{item}</span>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder || "Add an item..."}
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:bg-white transition-all"
        />
        <button
          type="button"
          onClick={addItem}
          className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
