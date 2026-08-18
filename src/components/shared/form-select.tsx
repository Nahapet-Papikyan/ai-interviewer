"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY = "__empty__";

export function FormSelect({
  id,
  name,
  defaultValue = "",
  placeholder,
  items,
  required,
  emptyLabel,
  className,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  items: readonly { value: string; label: string }[];
  required?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const selectItems = emptyLabel ? [{ value: EMPTY, label: emptyLabel }, ...items] : items;

  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        required={required}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => setValue(event.target.value)}
      >
        {emptyLabel || !required ? <option value="">{emptyLabel ?? ""}</option> : <option value="" disabled />}
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <Select
        value={value ? value : emptyLabel ? EMPTY : undefined}
        onValueChange={(next) => setValue(!next || next === EMPTY ? "" : next)}
      >
        <SelectTrigger id={id} className={cn("h-10 w-full rounded-xl", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {selectItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
