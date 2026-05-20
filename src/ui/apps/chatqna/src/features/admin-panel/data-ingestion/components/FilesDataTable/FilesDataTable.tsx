// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./FilesDataTable.scss";
import {
  DataTable,
  RowSelectionState,
  SearchBar,
} from "@intel-enterprise-rag-ui/components";
import { useCallback, useMemo, useState } from "react";

import {
  useGetFilesQuery,
  useRetryFileActionMutation,
} from "@/features/admin-panel/data-ingestion/api/edpApi";
import { useDeleteFileMutation } from "@/features/admin-panel/data-ingestion/api/s3Api";
import BatchActionsDropdown from "@/features/admin-panel/data-ingestion/components/BatchActionsDropdown/BatchActionsDropdown";
import BatchDeleteDialog from "@/features/admin-panel/data-ingestion/components/BatchDeleteDialog/BatchDeleteDialog";
import useConditionalPolling from "@/features/admin-panel/data-ingestion/hooks/useConditionalPolling";
import { FileDataItem } from "@/features/admin-panel/data-ingestion/types";
import { getFilesTableColumns } from "@/features/admin-panel/data-ingestion/utils/data-tables/files";

const FilesDataTable = () => {
  const { data: files, refetch, isLoading } = useGetFilesQuery();
  useConditionalPolling(files, refetch);

  const [retryFileAction] = useRetryFileActionMutation();
  const [deleteFileMutation] = useDeleteFileMutation();// Fix: utiliser la mutation

  const [filter, setFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const retryHandler = useCallback(
    (uuid: string) => {
      retryFileAction(uuid);
    },
    [retryFileAction],
  );
// DELETE
const deleteHandler = useCallback(
  async (id: string) => {
    // FORCEZ le log pour vérifier ce qui est envoyé
    console.log("Tentative de suppression de l'ID technique:", id); 
    
    try {
      await deleteFileMutation(id).unwrap();
    } catch (error) {
      console.error("Erreur suppression:", error);
    }
  },
  [deleteFileMutation]
);

// BATCH DELETE



  const filesTableColumns = useMemo(
    () =>
      getFilesTableColumns({
        retryHandler,
        deleteHandler
      }),
    [deleteHandler,  retryHandler],
  );

  const defaultData = useMemo(() => files ?? [], [files]);

  const selectedFiles = useMemo(() => {
    return Object.keys(rowSelection)
      .map((id) => defaultData.find((file) => file.id === id))
      .filter((file): file is FileDataItem => file !== undefined);
  }, [rowSelection, defaultData]);

  const retryableFiles = useMemo(() => {
    return selectedFiles.filter((file) => file.status === "error");
  }, [selectedFiles]);

  const handleBatchRetry = useCallback(async () => {
    await Promise.all(retryableFiles.map((file) => retryFileAction(file.id)));
    setRowSelection({});
  }, [retryableFiles, retryFileAction]);

  const handleBatchDelete = useCallback(async () => {
  await Promise.all(
    selectedFiles.map((file) => deleteHandler(file.id)) // Utilise bien file.id
  );
  setRowSelection({});
}, [selectedFiles, deleteHandler]);
  const selectedFileNames = useMemo(() => {
    return selectedFiles.map((file) => file.object_name);
  }, [selectedFiles]);

  const getRowId = useCallback((row: FileDataItem) => row.id, []);

  return (
    <div className="files-data-table-wrapper">
      <div className="files-data-table-wrapper__header">
        <SearchBar
          data-testid="files-search-bar"
          value={filter}
          placeholder="Filter files by status or name"
          onChange={setFilter}
        />
        <BatchActionsDropdown
          selectedCount={selectedFiles.length}
          retryableCount={retryableFiles.length}
          onRetry={handleBatchRetry}
          onDelete={() => setIsDeleteDialogOpen(true)}
        />
      </div>
      <DataTable
        defaultData={defaultData}
        columns={filesTableColumns}
        isDataLoading={isLoading}
        globalFilter={filter}
        className="files-data-table"
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={getRowId}
        enableRowSelection
      />
      <BatchDeleteDialog
        isOpen={isDeleteDialogOpen}
        itemType="files"
        itemNames={selectedFileNames}
        onConfirm={handleBatchDelete}
        onClose={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default FilesDataTable;