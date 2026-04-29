"use client";

import DeckGL from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import type { OrthographicViewState } from "@deck.gl/core";
import { useState, useCallback, useMemo } from "react";

import { makeCosmosLayers } from "@/components/atlas/CosmosLayer";
import { REGIONS, type Region } from "@/lib/atlas/regions";

const INITIAL_VIEW_STATE: OrthographicViewState = {
  target: [0, 0, 0],
  zoom: -1.5,
  minZoom: -3,
  maxZoom: 12,
};

export function CosmosCanvas({
  onActiveRegion,
}: {
  onActiveRegion?: (r: Region | null) => void;
}) {
  const [viewState, setViewState] =
    useState<OrthographicViewState>(INITIAL_VIEW_STATE);
  const [activeId, setActiveId] = useState<string | null>(null);

  const onClickRegion = useCallback(
    (r: Region) => {
      setActiveId(r.id);
      onActiveRegion?.(r);
      setViewState((prev) => ({
        ...prev,
        target: [r.position[0], r.position[1], 0],
        zoom: 2,
      }));
    },
    [onActiveRegion],
  );

  const layers = useMemo(
    () =>
      makeCosmosLayers({
        regions: REGIONS,
        onClickRegion,
        zoom: viewState.zoom as number,
      }),
    [onClickRegion, viewState.zoom],
  );

  // OrthographicView is a class — we instantiate once
  const views = useMemo(() => new OrthographicView({}), []);

  return (
    <>
      <DeckGL
        views={views}
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) =>
          setViewState(vs as OrthographicViewState)
        }
        controller={true}
        layers={layers}
        style={{
          background: "#030305",
          position: "absolute",
          top: "0px",
          left: "0px",
          right: "0px",
          bottom: "0px",
        }}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      />
      {(viewState.zoom as number) > 0 && (
        <button
          type="button"
          onClick={() => {
            setViewState(INITIAL_VIEW_STATE);
            setActiveId(null);
            onActiveRegion?.(null);
          }}
          className="absolute bottom-6 left-6 z-30 font-mono text-[10px] uppercase tracking-widest border border-cyan/50 text-cyan px-3 py-1.5 hover:bg-cyan hover:text-bg transition-colors pointer-events-auto"
        >
          ← back to cosmos
        </button>
      )}
      {/* `activeId` retained internally; the parent gets the Region object */}
      <span className="hidden" data-active-region-id={activeId} />
    </>
  );
}
