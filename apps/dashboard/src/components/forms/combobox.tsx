import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  value: string | number;
  label: string;
}

interface ComboboxProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  items: ComboboxItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function Combobox<TFieldValues extends FieldValues>({
  control,
  name,
  items,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled,
  className,
  triggerClassName,
}: ComboboxProps<TFieldValues>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return items;
    }

    const normalizedQuery = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        String(item.value).toLowerCase().includes(normalizedQuery),
    );
  }, [items, query]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedItem = items.find((item) => String(item.value) === String(field.value));

        return (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
                className={cn("w-full justify-between", triggerClassName)}
              >
                <span className="truncate">{selectedItem ? selectedItem.label : placeholder}</span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-(--radix-popover-trigger-width) p-0", className)}>
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={searchPlaceholder}
                  value={query}
                  onValueChange={setQuery}
                />
                <CommandList>
                  {filteredItems.length === 0 ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
                  <CommandGroup>
                    {filteredItems.map((item) => (
                      <CommandItem
                        key={String(item.value)}
                        value={`${item.label} ${item.value}`}
                        onSelect={() => {
                          field.onChange(item.value);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            String(field.value) === String(item.value)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        );
      }}
    />
  );
}
