"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered,
  Heading2,
  Quote,
  Undo,
  Redo
} from "lucide-react";

interface EditorProps {
  onChange: (value: string) => void;
  value: string;
}

export const Editor = ({ onChange, value }: EditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
        attributes: {
            class: "prose prose-sm focus:outline-none max-w-none min-h-[150px] px-4 py-3"
        }
    }
  });

  if (!editor) return null;

  const MenuButton = ({ 
    onClick, 
    isActive, 
    children, 
    title 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-2 rounded-lg transition-all hover:bg-gray-100",
        isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-500"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/30 focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-500/20 transition-all">
      <div className="flex flex-wrap items-center gap-1 p-1 bg-white border-b border-gray-100">
        <MenuButton 
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
        >
            <Bold size={18} />
        </MenuButton>
        <MenuButton 
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
        >
            <Italic size={18} />
        </MenuButton>
        <MenuButton 
            title="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive("underline")}
        >
            <UnderlineIcon size={18} />
        </MenuButton>
        <div className="w-px h-6 bg-gray-100 mx-1" />
        <MenuButton 
            title="Heading"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
        >
            <Heading2 size={18} />
        </MenuButton>
        <MenuButton 
            title="Bullet List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
        >
            <List size={18} />
        </MenuButton>
        <MenuButton 
            title="Ordered List"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
        >
            <ListOrdered size={18} />
        </MenuButton>
        <div className="w-px h-6 bg-gray-100 mx-1" />
        <MenuButton 
            title="Blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
        >
            <Quote size={18} />
        </MenuButton>
        <div className="flex-1" />
        <MenuButton 
            title="Undo"
            onClick={() => editor.chain().focus().undo().run()}
        >
            <Undo size={18} />
        </MenuButton>
        <MenuButton 
            title="Redo"
            onClick={() => editor.chain().focus().redo().run()}
        >
            <Redo size={18} />
        </MenuButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
