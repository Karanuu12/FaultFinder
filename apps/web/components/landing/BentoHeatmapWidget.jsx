"use client";

import React from "react";
import { heatmapData } from "./landingData";

const LEVEL_COLORS = ["#eef2e6", "#cbe8b0", "#94cd59", "#5fae45", "#359462"];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

export default function BentoHeatmapWidget() {
  return (
    <div className="rounded-3xl border border-[#f0d9b8]/70 bg-[#fff2df] px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-instrumental text-2xl leading-none text-[#151515]">
          Consistency
        </h3>
        <span className="font-poppins text-[10px] font-medium uppercase tracking-[0.18em] text-[#c64e27]">
          52 weeks
        </span>
      </div>

      <div className="mt-5 flex gap-2">
        <div className="flex flex-col justify-between py-0.5">
          {["M", null, "W", null, "F", null].map((label, i) => (
            <span
              key={i}
              className="flex h-[11px] items-center font-poppins text-[8px] font-medium text-[#b08968]"
            >
              {label || ""}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between gap-[3px] pr-1">
            {MONTH_LABELS.map((label) => (
              <span
                key={label}
                className="font-poppins text-[8px] font-medium text-[#b08968]"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px]">
            {heatmapData.map((week, wi) => (
              <div key={wi} className="flex flex-1 flex-col gap-[3px]">
                {week.map((level, di) => (
                  <div
                    key={di}
                    className="aspect-square w-full rounded-[2px]"
                    style={{ backgroundColor: LEVEL_COLORS[level] }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1.5 font-poppins text-[9px] font-medium text-[#b08968]">
        <span>Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <span
            key={i}
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ backgroundColor: color }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
