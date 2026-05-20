// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { ScannerInputsProps } from "@/features/admin-panel/control-plane/components/cards/scanner-inputs";
import ScannerInputsTitle from "@/features/admin-panel/control-plane/components/cards/scanner-inputs/ScannerInputsTitle";
import ServiceArgumentCheckbox from "@/features/admin-panel/control-plane/components/ServiceArgumentCheckbox/ServiceArgumentCheckbox";
import ServiceArgumentNumberInput from "@/features/admin-panel/control-plane/components/ServiceArgumentNumberInput/ServiceArgumentNumberInput";
import ServiceArgumentSelectInput from "@/features/admin-panel/control-plane/components/ServiceArgumentSelectInput/ServiceArgumentSelectInput";
import {
  ToxicityScannerArgs,
  ToxicityScannerConfig,
} from "@/features/admin-panel/control-plane/config/chat-qna-graph/guards/scanners";
import useGuardScannerInputs from "@/features/admin-panel/control-plane/hooks/useGuardScannerInputs";

const ToxicityScannerInputs = ({
  previousArgumentsValues,
  config,
  handlers,
}: ScannerInputsProps<ToxicityScannerArgs, ToxicityScannerConfig>) => {
  const safeValues = previousArgumentsValues || { enabled: false, threshold: 0.5, match_type: "full_match" };

  const {
    titleCasedName,
    handleArgumentValueChange,
    handleArgumentValidityChange,
  } = useGuardScannerInputs("toxicity", handlers);

  return (
    <>
      <ScannerInputsTitle>{titleCasedName}</ScannerInputsTitle>
      <ServiceArgumentCheckbox
        {...config.enabled}
        value={safeValues.enabled}
        onArgumentValueChange={handleArgumentValueChange}
      />
      <ServiceArgumentNumberInput
        {...config.threshold}
        value={safeValues.threshold}
        onArgumentValueChange={handleArgumentValueChange}
        onArgumentValidityChange={handleArgumentValidityChange}
      />
      <ServiceArgumentSelectInput
        {...config.match_type}
        value={safeValues.match_type}
        onArgumentValueChange={handleArgumentValueChange}
      />
    </>
  );
};

export default ToxicityScannerInputs;
