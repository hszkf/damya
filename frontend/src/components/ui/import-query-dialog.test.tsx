import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportQueryDialog } from "./import-query-dialog";
import * as savedQueries from "~/lib/saved-queries";

// Mock the saved-queries module
vi.mock("~/lib/saved-queries", () => ({
  getFilteredQueries: vi.fn(),
  deleteLocalQuery: vi.fn(),
}));

// Mock the toast provider
vi.mock("./toast-provider", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const mockQueries: savedQueries.LocalSavedQuery[] = [
  {
    id: "query-1",
    query_name: "Test Query 1",
    query_text: "SELECT * FROM users",
    query_type: "redshift",
    author: "Hasif",
    description: "A test query",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "query-2",
    query_name: "Another Query",
    query_text: "SELECT * FROM orders",
    query_type: "redshift",
    author: "Nazierul",
    description: "Another test query",
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  },
];

describe("ImportQueryDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onQuerySelect: vi.fn(),
    queryType: "redshift" as const,
    colorScheme: "redshift" as const,
  };

  beforeEach(() => {
    vi.mocked(savedQueries.getFilteredQueries).mockReturnValue(mockQueries);
    vi.mocked(savedQueries.deleteLocalQuery).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Delete Confirmation Modal", () => {
    it("should show delete confirmation modal when delete button is clicked", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      // Wait for queries to load
      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      // Find and click the delete button for the first query
      const deleteButtons = screen.getAllByTestId("delete-query-button");
      fireEvent.click(deleteButtons[0]);

      // Confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-modal")).toBeInTheDocument();
      });

      // Should show the query name in the modal
      expect(screen.getByText("Delete Query")).toBeInTheDocument();
      expect(screen.getByText("Are you sure you want to delete this saved query?")).toBeInTheDocument();
    });

    it("should show query details in delete confirmation modal", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId("delete-query-button");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-modal")).toBeInTheDocument();
      });

      // The modal should contain the query name (it appears twice - in list and modal)
      const queryNames = screen.getAllByText("Test Query 1");
      expect(queryNames.length).toBeGreaterThanOrEqual(2);
    });

    it("should close confirmation modal when cancel is clicked", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId("delete-query-button");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-modal")).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByTestId("cancel-delete-button");
      fireEvent.click(cancelButton);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByTestId("delete-confirmation-modal")).not.toBeInTheDocument();
      });

      // Query should still exist
      expect(savedQueries.deleteLocalQuery).not.toHaveBeenCalled();
    });

    it("should delete query when confirm is clicked", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId("delete-query-button");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-modal")).toBeInTheDocument();
      });

      // Click confirm delete button
      const confirmButton = screen.getByTestId("confirm-delete-button");
      fireEvent.click(confirmButton);

      // deleteLocalQuery should have been called with the correct ID
      await waitFor(() => {
        expect(savedQueries.deleteLocalQuery).toHaveBeenCalledWith("query-1");
      });
    });

    it("should close confirmation modal after successful deletion", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId("delete-query-button");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-modal")).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId("confirm-delete-button");
      fireEvent.click(confirmButton);

      // Modal should be closed after deletion
      await waitFor(() => {
        expect(screen.queryByTestId("delete-confirmation-modal")).not.toBeInTheDocument();
      });
    });

    it("should not delete when clicking outside the item", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      // Click on the query item itself (not delete button)
      const queryItem = screen.getByText("Test Query 1");
      fireEvent.click(queryItem);

      // onQuerySelect should be called, not delete
      expect(defaultProps.onQuerySelect).toHaveBeenCalled();
      expect(savedQueries.deleteLocalQuery).not.toHaveBeenCalled();
    });

    it("should reload queries after deletion", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      // Clear mock calls from initial load
      vi.mocked(savedQueries.getFilteredQueries).mockClear();

      const deleteButtons = screen.getAllByTestId("delete-query-button");
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-modal")).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId("confirm-delete-button");
      fireEvent.click(confirmButton);

      // getFilteredQueries should be called again to reload the list
      await waitFor(() => {
        expect(savedQueries.getFilteredQueries).toHaveBeenCalled();
      });
    });
  });

  describe("Query List", () => {
    it("should display saved queries", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
        expect(screen.getByText("Another Query")).toBeInTheDocument();
      });
    });

    it("should show empty state when no queries", async () => {
      vi.mocked(savedQueries.getFilteredQueries).mockReturnValue([]);

      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("No saved queries yet")).toBeInTheDocument();
      });
    });

    it("should have search input available", async () => {
      render(<ImportQueryDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Query 1")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search queries...");
      expect(searchInput).toBeInTheDocument();
    });
  });
});
