// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { LinkForIngestion } from "@/features/admin-panel/data-ingestion/types";

const createToBeUploadedMessage = (
  files: File[],
  links: LinkForIngestion[],
) => {
  let message = "";
  if (files.length > 0 ) {
    message += `${files.length} file${files.length > 1 ? "s" : ""} `;
  }
  if (files.length > 0  && links.length > 0) {
    message += "and ";
  }
  if (links.length > 0) {
    message += `${links.length} link${links.length > 1 ? "s" : ""}`;
  }
  if ((files.length > 0 ) || links.length > 0) {
    message += " to be uploaded";
  }
  return message;
};

const isUploadDisabled = (
  files: File[],
  links: LinkForIngestion[],
  isUploading: boolean,
) => {
  if (isUploading) {
    return true;
  }

  const areFilesReadyToUpload = files.length > 0 ;
  const areLinksReadyToUpload = links.length > 0;

  return !areFilesReadyToUpload && !areLinksReadyToUpload;
};

export { createToBeUploadedMessage, isUploadDisabled };
