"use client";

import { useState } from "react";
import { TipMeTokenModal } from "./TipMeTokenModal";

type StationSupportButtonProps = {
  meTokenAddress: string;
  stationName: string;
};

export function StationSupportButton({
  meTokenAddress,
  stationName
}: StationSupportButtonProps) {
  const [open, setOpen] = useState(false);
  if (!meTokenAddress) return null;

  return (
    <>
      <button
        type="button"
        className="button btn-led btn-led-green"
        onClick={() => setOpen(true)}
      >
        Support / Buy meToken
      </button>
      <TipMeTokenModal
        open={open}
        onClose={() => setOpen(false)}
        meTokenAddress={meTokenAddress}
        curatorLabel={stationName}
      />
    </>
  );
}
