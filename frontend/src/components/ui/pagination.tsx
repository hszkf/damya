

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  colorScheme?: "redshift";
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  colorScheme = "redshift",
  className,
}: PaginationProps) {
  // Generate page numbers to display
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push("ellipsis");
        for (let i = totalPages - 3; i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  const buttonBaseClasses = cn(
    "inline-flex items-center justify-center",
    "h-7 min-w-[28px] px-2 text-xs font-medium rounded",
    "transition-colors duration-150",
    "disabled:opacity-40 disabled:cursor-not-allowed"
  );

  const activeClasses = "bg-redshift text-white";

  const inactiveClasses = cn(
    "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
  );

  const navButtonClasses = cn(
    buttonBaseClasses,
    "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
    "disabled:hover:bg-transparent"
  );

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className={cn("flex items-center gap-1", className)}
      aria-label="Pagination"
    >
      {/* First page button */}
      <button
        className={navButtonClasses}
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        aria-label="Go to first page"
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>

      {/* Previous page button */}
      <button
        className={navButtonClasses}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers */}
      <div className="flex items-center gap-1 mx-1">
        {pageNumbers.map((page, index) => {
          if (page === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-1 text-on-surface-variant text-xs"
              >
                ...
              </span>
            );
          }

          const isActive = page === currentPage;
          return (
            <button
              key={page}
              className={cn(
                buttonBaseClasses,
                isActive ? activeClasses : inactiveClasses
              )}
              onClick={() => onPageChange(page)}
              aria-label={`Go to page ${page}`}
              aria-current={isActive ? "page" : undefined}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next page button */}
      <button
        className={navButtonClasses}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Go to next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Last page button */}
      <button
        className={navButtonClasses}
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        aria-label="Go to last page"
      >
        <ChevronsRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
