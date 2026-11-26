import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { AsyncBoundary } from "@/components/async-boundary";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SuspenseOptions } from "@/components/ui/entity-page";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EntitySelectProps<MMultiSelect extends boolean = false> {
  /** e.g. `queryUtils.x.getOptionsForForm.queryOptions({ select: (r) => r.body })` */
  options: SuspenseOptions<{ id: number; name: string }[]>;
  multiSelect?: MMultiSelect;
  value: MMultiSelect extends true ? Array<string | number> : string | number;
  onChange: (value: MMultiSelect extends true ? Array<string | number> : string | number) => void;
  defaultValue?: MMultiSelect extends true ? Array<string | number> : string | number;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  width?: string | number;
  triggerClassName?: string;
}

export function EntitySelect<M extends boolean = false>(props: EntitySelectProps<M>) {
  return (
    <AsyncBoundary
      loadingFallback={<EntitySelectFallback {...props} />}
      errorFallback={<EntitySelectFallback {...props} />}
    >
      <EntitySelectContent {...props} />
    </AsyncBoundary>
  );
}

function EntitySelectContent<MMultiSelect extends boolean = false>({
  options: optionsQuery,
  multiSelect,
  label,
  placeholder = "Select...",
  value,
  onChange,
  defaultValue,
  disabled = false,
  width = "200px",
  triggerClassName,
}: EntitySelectProps<MMultiSelect>) {
  const { data: options } = useSuspenseQuery(optionsQuery);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const effectiveValue = defaultValue ?? value;
  const isLocked = defaultValue !== undefined;

  const selectedValues = useMemo(
    () =>
      (multiSelect ? (Array.isArray(effectiveValue) ? effectiveValue : []) : []) as Array<
        string | number
      >,
    [effectiveValue, multiSelect],
  );

  const selectedOption = useMemo(
    () =>
      multiSelect
        ? undefined
        : options.find((option) => String(option.id) === String(effectiveValue)),
    [options, effectiveValue, multiSelect],
  );

  const selectedOptions = useMemo(
    () =>
      multiSelect
        ? options.filter((option) =>
            selectedValues.some((value) => String(value) === String(option.id)),
          )
        : [],
    [options, selectedValues, multiSelect],
  );

  const filteredOptions = useMemo(
    () =>
      searchTerm
        ? options.filter((option) => option.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : options,
    [options, searchTerm],
  );

  const handleSelect = (currentValue: string | number) => {
    if (isLocked) return;

    if (multiSelect) {
      const nextValues = selectedValues.some((value) => String(value) === String(currentValue))
        ? selectedValues.filter((value) => String(value) !== String(currentValue))
        : [...selectedValues, currentValue];

      onChange(nextValues as MMultiSelect extends true ? Array<string | number> : string | number);
      return;
    }

    onChange(
      (currentValue === value ? "" : currentValue) as MMultiSelect extends true
        ? Array<string | number>
        : string | number,
    );
    setOpen(false);
    setSearchTerm("");
  };

  const triggerLabel = multiSelect
    ? selectedOptions.length > 0
      ? selectedOptions.map((option) => option.name).join(", ")
      : placeholder
    : (selectedOption?.name ?? placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between",
            (disabled || isLocked) && "cursor-not-allowed opacity-50",
            triggerClassName,
          )}
          style={{ width }}
          disabled={disabled || isLocked}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="opacity-50" size={10} />
        </Button>
      </PopoverTrigger>

      <PopoverContent style={{ width }} className="p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}...`}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {filteredOptions.length === 0 && (
              <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            )}

            <CommandGroup>
              {filteredOptions.map((option) => {
                const isSelected = multiSelect
                  ? selectedValues.some((value) => String(value) === String(option.id))
                  : String(value) === String(option.id);

                return (
                  <CommandItem
                    key={option.id}
                    value={String(option.id)}
                    onSelect={() => handleSelect(option.id)}
                  >
                    <span>
                      {option.name}{" "}
                      <span className="text-xs text-muted-foreground">#{option.id}</span>
                    </span>

                    <Check
                      className={cn("ml-auto h-3 w-3", isSelected ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EntitySelectFallback<M extends boolean = false>({
  label,
  placeholder = "Select...",
  value,
  defaultValue,
  width = "200px",
  triggerClassName,
}: EntitySelectProps<M>) {
  return (
    <Button
      variant="outline"
      role="combobox"
      className={cn("justify-between", triggerClassName)}
      style={{ width: width }}
      disabled={true}
    >
      {(defaultValue ?? value) ? `Loading ${label.toLowerCase()}...` : placeholder}
      <ChevronsUpDown className="opacity-50" size={10} />
    </Button>
  );
}
