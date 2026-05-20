// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./UploadDataDialog.scss";

import {
  addNotification,
  Dialog,
  DialogRef,
  IconButton,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import { useRef, useState } from "react";

import {
  useLazyGetFilesQuery,
  useLazyGetLinksQuery,
  usePostFileMutation,        
  usePostLinksMutation,
} from "@/features/admin-panel/data-ingestion/api/edpApi";
import FilesIngestionPanel from "@/features/admin-panel/data-ingestion/components/FilesIngestionPanel/FilesIngestionPanel";
import LinksIngestionPanel from "@/features/admin-panel/data-ingestion/components/LinksIngestionPanel/LinksIngestionPanel";
import UploadDataDialogFooter from "@/features/admin-panel/data-ingestion/components/UploadDataDialogFooter/UploadDataDialogFooter";
import { ERROR_MESSAGES } from "@/features/admin-panel/data-ingestion/config/api";
import {
  LinkForIngestion,
  UploadErrors,
} from "@/features/admin-panel/data-ingestion/types";
import {
  createToBeUploadedMessage,
  isUploadDisabled,
} from "@/features/admin-panel/data-ingestion/utils";
import { useAppDispatch } from "@/store/hooks";
import { getErrorMessage } from "@/utils/api";

const initialUploadErrors = {
  files: "",
  links: "",
};

const UploadDataDialog = () => {
  const [getFiles] = useLazyGetFilesQuery();
  const [getLinks] = useLazyGetLinksQuery();
  const [postFile] = usePostFileMutation();   // ← direct vers ton backend
  const [postLinks] = usePostLinksMutation();

  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<LinkForIngestion[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrors, setUploadErrors] =
    useState<UploadErrors>(initialUploadErrors);

  const dialogRef = useRef<DialogRef>(null);
  const dispatch = useAppDispatch();

  const resetUploadErrors = () => {
    setUploadErrors(initialUploadErrors);
  };

  const onDialogClose = () => {
    setFiles([]);
    setLinks([]);
    resetUploadErrors();
    dialogRef.current?.close();
  };

  const submitUploadData = async () => {
    resetUploadErrors();
    setIsUploading(true);

    let filesUploadError = "";
    let linksUploadError = "";

    // ✅ Upload direct vers ton backend .NET — plus de presigned URL S3
    if (files.length) {
      let error;
      for (const file of files) {
        const { error: postFileError } = await postFile(file);
        if (postFileError) {
          error = postFileError;
          break;
        }
      }

      if (error) {
        filesUploadError = getErrorMessage(error, ERROR_MESSAGES.POST_FILES);
      } else {
        setFiles([]);
      }
    }

    if (links.length) {
      const linksUrls = links.map(({ value }) => value);
      const { error } = await postLinks(linksUrls);

      if (error) {
        linksUploadError = getErrorMessage(error, ERROR_MESSAGES.POST_LINKS);
      } else {
        setLinks([]);
      }
    }

    if (filesUploadError || linksUploadError) {
      setUploadErrors({
        links: linksUploadError,
        files: filesUploadError,
      });
    } else {
      setUploadErrors(initialUploadErrors);
      onDialogClose();
      dispatch(
        addNotification({
          text: "Successful data upload!",
          severity: "success",
        }),
      );
      Promise.all([getFiles().refetch(), getLinks().refetch()]);
    }

    setIsUploading(false);
  };
  const toBeUploadedMessage = createToBeUploadedMessage(files, links);

  return (
    <Dialog
      ref={dialogRef}
      data-testid="upload-data-dialog"
      trigger={
        <Tooltip
          title="Upload Data"
          trigger={
            <IconButton
              data-testid="upload-data-trigger-button"
              icon="upload"
              variant="contained"
            />
          }
        />
      }
      footer={
        <UploadDataDialogFooter
          uploadErrors={uploadErrors}
          toBeUploadedMessage={toBeUploadedMessage}
          isUploadDisabled={isUploadDisabled(files, links, isUploading)}  
          isUploading={isUploading}
          onSubmit={submitUploadData}
        />
      }
      title="Upload Data"
      onClose={onDialogClose}
    >
      <div className="upload-dialog__content">
        <div className="upload-dialog__ingestion-panels-grid">
          <FilesIngestionPanel files={files} setFiles={setFiles} />
          <LinksIngestionPanel links={links} setLinks={setLinks} />
        </div>
        {isUploading && <div className="upload-dialog__blur-overlay"></div>}
      </div>
    </Dialog>
  );
};

export default UploadDataDialog;