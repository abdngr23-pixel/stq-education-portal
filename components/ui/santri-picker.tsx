"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import {
  SantriPickerItem,
  formatSantriPickerLabel,
  matchesSantriSearch,
  sortSantriPickerList,
} from "@/lib/santri-picker";

export interface SantriPickerProps<T extends SantriPickerItem = SantriPickerItem> {
  items: T[];
  value: string;
  onChange: (value: string, item?: T) => void;
  valueKey?: "id" | "nis";
  id?: string;
  name?: string;
  "data-testid"?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
  emptyMessage?: string;
  autoSort?: boolean;
  ariaLabel?: string;
}

export function SantriPicker<T extends SantriPickerItem = SantriPickerItem>({
  items,
  value,
  onChange,
  valueKey = "id",
  id,
  name,
  "data-testid": dataTestId,
  placeholder = "-- Pilih Santri --",
  disabled = false,
  required = false,
  className = "",
  buttonClassName = "",
  emptyMessage = "Memuat data santri atau belum ada santri...",
  autoSort = true,
  ariaLabel,
}: SantriPickerProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Deterministically sort list if requested
  const sortedItems = useMemo(() => {
    return autoSort ? sortSantriPickerList(items) : items;
  }, [items, autoSort]);

  // Find currently selected santri item
  const selectedItem = useMemo(() => {
    return sortedItems.find(
      (item) => (valueKey === "nis" ? item.nis : item.id) === value
    );
  }, [sortedItems, value, valueKey]);

  // Selected label must equal dropdown label
  const selectedDisplayLabel = useMemo(() => {
    if (!selectedItem) return "";
    return formatSantriPickerLabel(selectedItem, sortedItems);
  }, [selectedItem, sortedItems]);

  // Filter items based on multi-attribute search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return sortedItems;
    return sortedItems.filter((item) => matchesSantriSearch(item, searchQuery));
  }, [sortedItems, searchQuery]);

  const openPicker = () => {
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const closePicker = () => {
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(0);
  };

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closePicker();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keep highlighted index in view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (item: T) => {
    const nextVal = valueKey === "nis" ? item.nis : item.id;
    onChange(nextVal, item);
    closePicker();
    triggerButtonRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPicker();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closePicker();
      triggerButtonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredItems.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        handleSelect(filteredItems[highlightedIndex]);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* 
        Underlying Native Select
        Maintains contract with automated testing (e.g. Puppeteer page.select,
        #santri-selector, data-testid, and form submission)
      */}
      <select
        id={id}
        name={name}
        data-testid={dataTestId}
        value={value}
        onChange={(e) => {
          const nextVal = e.target.value;
          const found = sortedItems.find(
            (it) => (valueKey === "nis" ? it.nis : it.id) === nextVal
          );
          onChange(nextVal, found);
        }}
        onFocus={() => triggerButtonRef.current?.focus()}
        disabled={disabled}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {sortedItems.map((item) => {
          const itemVal = valueKey === "nis" ? item.nis : item.id;
          const label = formatSantriPickerLabel(item, sortedItems);
          return (
            <option key={itemVal} value={itemVal}>
              {label}
            </option>
          );
        })}
      </select>

      {/* Visible Combobox Trigger Button */}
      <button
        ref={triggerButtonRef}
        type="button"
        id={id ? `${id}-trigger` : undefined}
        data-testid={dataTestId ? `${dataTestId}-trigger` : undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        onClick={() => (isOpen ? closePicker() : openPicker())}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 transition-all flex items-center justify-between gap-2 text-left hover:bg-slate-100/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${buttonClassName}`}
      >
        <span
          className={`truncate ${
            selectedItem ? "text-slate-900 font-semibold" : "text-slate-400 font-normal"
          }`}
        >
          {selectedDisplayLabel || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#0E7C3A]" : ""
          }`}
        />
      </button>

      {/* Searchable Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-80 flex flex-col"
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/60 sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Cari nama, angkatan, kelas, NIS..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  aria-label="Hapus pencarian"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="overflow-y-auto max-h-60 p-1.5 space-y-0.5"
          >
            {sortedItems.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-500">
                {emptyMessage}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-500">
                Tidak ada santri yang cocok dengan &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const itemVal = valueKey === "nis" ? item.nis : item.id;
                const isSelected = itemVal === value;
                const isHighlighted = index === highlightedIndex;
                const label = formatSantriPickerLabel(item, sortedItems);

                return (
                  <button
                    key={itemVal}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(item)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#0E7C3A]/10 text-[#0E7C3A] font-bold"
                        : isHighlighted
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "text-slate-800 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-[#0E7C3A]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
