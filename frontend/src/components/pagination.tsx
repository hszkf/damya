'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false
}: PaginationProps) {
  // Don't render if there's only 1 page
  if (totalPages <= 1) return null;

  // Calculate which page numbers to show
  const getVisiblePages = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="flex items-center justify-between px-2 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
        <span>
          Page {currentPage} of {totalPages}
        </span>
      </div>

      <div className="flex items-center space-x-1">
        {/* Previous button */}
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1 || disabled}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {visiblePages.map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-3 py-2 text-gray-500">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  disabled={disabled}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    page === currentPage
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {page}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages || disabled}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
}