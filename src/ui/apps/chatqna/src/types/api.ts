// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

export interface GetFilePresignedUrlRequest {
  id: string;
  fileName?: string;
  method?: string;
}


export interface DownloadFileRequest {
  presignedUrl: string;
  fileName: string;
}
