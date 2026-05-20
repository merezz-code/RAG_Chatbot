// Copyright (C) 2024-2026 MonRAG
// SPDX-License-Identifier: Apache-2.0

import "./AboutDialog.scss";

import {
  Dialog,
  DialogRef,
  IconButton,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import { ExternalLinkIcon } from "@intel-enterprise-rag-ui/icons";
import { useRef } from "react";

// Remplacement par tes URLs de projet (Jira et contact mail POC)
const JIRA_BACKLOG_URL = "https://jira.atlassian.com"; // Change par ton vrai lien Jira si nécessaire
const POC_SUPPORT_MAIL = "mailto:poc@company.com?subject=MonRAG%20Support%20Request";

interface AboutDialogProps {
  appName: string;
  appVersion: string;
  userGuideUrl?: string;
}

export const AboutDialog = ({
  appName,
  appVersion,
  userGuideUrl,
}: AboutDialogProps) => {
  const trigger = (
    <Tooltip
      title="About"
      trigger={
        <IconButton data-testid="about-dialog-trigger-button" icon="info" />
      }
    />
  );

  const dialogRef = useRef<DialogRef>(null);

  const handleClose = () => {
    dialogRef.current?.close();
  };

  return (
    <Dialog
      ref={dialogRef}
      data-testid="about-dialog"
      trigger={trigger}
      title="About"
      maxWidth={600}
      onClose={handleClose}
      hasPlainHeader
      isCentered
    >
      <div className="about-dialog">
        <h2>{appName}</h2>
        <p className="app-version">
          <span className="font-medium">Version:</span> {appVersion}
        </p>
        
        {userGuideUrl && (
          <p>
            The{" "}
            <a href={userGuideUrl} target="_blank" rel="noopener noreferrer">
              User Guide
              <ExternalLinkIcon fontSize={10} />
            </a>{" "}
            provides detailed instructions and helpful tips for using all
            features of this application. Please refer to it for guidance and
            best practices.
          </p>
        )}
        
        <p>
          To request a feature or report an issue, please open a new issue on our{" "}
          <a href={JIRA_BACKLOG_URL} target="_blank" rel="noopener noreferrer">
            Jira Backlog
            <ExternalLinkIcon fontSize={10} />
          </a>{" "}
          page.
        </p>
        
        <p>
          If you need support, please{" "}
          <a href={POC_SUPPORT_MAIL} rel="noopener noreferrer">
            create a request
            <ExternalLinkIcon fontSize={10} />
          </a>
          . Select <b className="font-medium">Software</b> and{" "}
          <b className="font-medium">MonRAG AI for Enterprise</b>.
        </p>
      </div>
    </Dialog>
  );
};