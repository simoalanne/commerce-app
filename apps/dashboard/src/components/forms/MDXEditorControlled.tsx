import {
  AdmonitionDirectiveDescriptor,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  directivesPlugin,
  headingsPlugin,
  InsertThematicBreak,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  type MDXEditorMethods,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import React from "react";

/**
 * A controlled wrapper for MDXEditor that handles form resets, external loads,
 * and fixes z-index dropdown rendering quirks within dialogs.
 */
export function MDXEditorControlled({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  const editorRef = React.useRef<MDXEditorMethods>(null);

  // Sync external state changes (like form resets or database fetching updates)
  React.useEffect(() => {
    if (editorRef.current) {
      const currentMarkdown = editorRef.current.getMarkdown();
      // Use live Lexical output to avoid spacing/newline mismatches
      if (value !== currentMarkdown) {
        editorRef.current.setMarkdown(value);
      }
    }
  }, [value]);

  const plugins = React.useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      linkDialogPlugin(), // Restored UI overlay configuration for inputs
      markdownShortcutPlugin(),
      linkPlugin(),
      thematicBreakPlugin(),
      directivesPlugin({
        directiveDescriptors: [AdmonitionDirectiveDescriptor],
      }),
      toolbarPlugin({
        toolbarContents: () => (
          <div className="flex w-full flex-wrap items-center gap-1 border-b pb-1 dark:border-zinc-800">
            <UndoRedo />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles />
            <InsertThematicBreak />
            <CreateLink />
          </div>
        ),
      }),
    ],
    [],
  );

  return (
    <div className="relative w-full overflow-hidden rounded-md border bg-background dark:border-zinc-800">
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={onChange}
        onBlur={onBlur}
        contentEditableClassName="outline-none min-h-[300px] p-4 prose dark:prose-invert max-w-none focus:outline-none"
        plugins={plugins}
      />
    </div>
  );
}
