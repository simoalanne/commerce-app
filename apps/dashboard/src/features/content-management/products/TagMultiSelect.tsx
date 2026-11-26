import type { InferClientResponse } from "@rest-rpc/core";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AsyncBoundary } from "@/components/async-boundary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { queryUtils } from "@/context/ApiClientContext";

const DEFAULT_NEW_TAG_COLOR = "#16a34a";

// Pick black/white text so a tag label stays readable on its own color.
const readableTextColor = (hex: string) => {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#ffffff";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
};

interface TagMultiSelectProps {
  value: number[];
  onChange: (value: number[]) => void;
}

export function TagMultiSelect(props: TagMultiSelectProps) {
  return (
    <AsyncBoundary
      loadingFallback={
        <Button variant="outline" className="w-full justify-start" disabled>
          Loading tags...
        </Button>
      }
      errorFallback={
        <Button variant="outline" className="w-full justify-start" disabled>
          Failed to load tags
        </Button>
      }
    >
      <TagMultiSelectContent {...props} />
    </AsyncBoundary>
  );
}

type Tag = InferClientResponse<typeof queryUtils.tags.getAll.fetch>["body"][number];

function TagMultiSelectContent({ value, onChange }: TagMultiSelectProps) {
  const queryClient = useQueryClient();
  const { data: tags } = useSuspenseQuery(
    queryUtils.tags.getAll.queryOptions({ select: (r) => r.body }),
  );
  const createMutation = useMutation(queryUtils.tags.create.mutationOptions());
  const updateMutation = useMutation(queryUtils.tags.update.mutationOptions());
  const deleteMutation = useMutation(queryUtils.tags.delete.mutationOptions());

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_TAG_COLOR);
  const [editing, setEditing] = useState<{
    id: number;
    name: string;
    color: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const selectedTags = tags.filter((tag) => value.includes(tag.id));
  const query = search.trim();
  const filteredTags = query
    ? tags.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()))
    : tags;
  const hasExactMatch = tags.some((tag) => tag.name.toLowerCase() === query.toLowerCase());

  const toggleTag = (id: number) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const removeSelected = (id: number) => onChange(value.filter((v) => v !== id));

  const createTag = () => {
    if (!query || createMutation.isPending) return;

    createMutation.mutate(
      { body: { name: query, color: newColor } },
      {
        onSuccess({ body: { id } }) {
          queryClient.invalidateQueries({
            queryKey: queryUtils.tags.getAll.queryKey(),
          });
          onChange([...value, id]);
          setSearch("");
          setNewColor(DEFAULT_NEW_TAG_COLOR);
        },
        onError(error) {
          toast.error(`Failed to create tag: ${error.message}`);
        },
      },
    );
  };

  const saveEdit = () => {
    if (!editing || updateMutation.isPending) return;
    const name = editing.name.trim();
    if (!name) return;

    updateMutation.mutate(
      { params: { id: editing.id }, body: { name, color: editing.color } },
      {
        onSuccess() {
          queryClient.invalidateQueries({
            queryKey: queryUtils.tags.getAll.queryKey(),
          });
          setEditing(null);
        },
        onError(error) {
          toast.error(`Failed to update tag: ${error.message}`);
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting || deleteMutation.isPending) return;
    const { id } = deleting;

    deleteMutation.mutate(
      { params: { id } },
      {
        onSuccess() {
          queryClient.invalidateQueries({
            queryKey: queryUtils.tags.getAll.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: queryUtils.products.getAll.queryKey(),
          });
          removeSelected(id);
          setDeleting(null);
        },
        onError() {
          toast.error("Failed to delete tag. Please try again.");
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedTags.length === 0 ? (
          <span className="text-sm text-muted-foreground">No tags selected</span>
        ) : (
          selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              className="gap-1 border-transparent pr-1"
              style={{
                backgroundColor: tag.color,
                color: readableTextColor(tag.color),
              }}
            >
              <span>{tag.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-4 w-4 rounded-full p-0 hover:bg-black/20 hover:opacity-100"
                onClick={() => removeSelected(tag.id)}
                aria-label={`Remove ${tag.name}`}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))
        )}
      </div>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start"
          >
            <Plus className="size-4 opacity-50" />
            Add or manage tags...
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          {editing ? (
            <div className="space-y-3 p-3">
              <p className="text-xs text-muted-foreground">
                Editing tag label (for the current content language) and color.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editing.color}
                  onChange={(event) => setEditing({ ...editing, color: event.target.value })}
                  className="size-9 shrink-0 cursor-pointer rounded border bg-transparent p-0"
                  aria-label="Tag color"
                />
                <Input
                  autoFocus
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  placeholder="Tag label"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveEdit();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search or create a tag..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {filteredTags.length === 0 && !query ? (
                  <CommandEmpty>No tags yet.</CommandEmpty>
                ) : null}

                <CommandGroup>
                  {filteredTags.map((tag) => {
                    const isSelected = value.includes(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        value={String(tag.id)}
                        onSelect={() => toggleTag(tag.id)}
                        className="gap-2"
                      >
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                        <Check
                          className={
                            isSelected ? "ml-auto size-4 opacity-100" : "ml-auto size-4 opacity-0"
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-6"
                          aria-label={`Edit ${tag.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing({
                              id: tag.id,
                              name: tag.name,
                              color: tag.color,
                            });
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-6 text-destructive"
                          aria-label={`Delete ${tag.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpen(false);
                            setDeleting(tag);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>

                {query && !hasExactMatch ? (
                  <CommandGroup>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <input
                        type="color"
                        value={newColor}
                        onChange={(event) => setNewColor(event.target.value)}
                        className="size-7 shrink-0 cursor-pointer rounded border bg-transparent p-0"
                        aria-label="New tag color"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 flex-1 justify-start gap-2 px-2"
                        onClick={createTag}
                        disabled={createMutation.isPending}
                      >
                        <Plus className="size-4" />
                        <span className="truncate">Create "{query}"</span>
                      </Button>
                    </div>
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.productCount
                ? `This tag is used by ${deleting.productCount} product${
                    deleting.productCount === 1 ? "" : "s"
                  }. Deleting it removes the tag from all of them.`
                : "This removes the tag from the library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
