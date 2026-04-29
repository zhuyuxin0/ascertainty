"use client";

import DeckGL from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import type { OrthographicViewState } from "@deck.gl/core";
import { useState, useCallback, useMemo, useEffect } from "react";

import { makeCosmosLayers } from "@/components/atlas/CosmosLayer";
import { makeEntityLayers } from "@/components/atlas/EntityLayer";
import { REGIONS, type Region } from "@/lib/atlas/regions";
import { bandFromZoom, bandOpacity } from "@/lib/atlas/zoomLevels";
import type { AtlasModel, AtlasMarket } from "@/lib/atlas/types";
import { API_URL } from "@/lib/api";

const INITIAL_VIEW_STATE: OrthographicViewState = {
  target: [0, 0, 0],
  zoom: -1.5,
  minZoom: -3,
  maxZoom: 12,
};

export function CosmosCanvas({
  onActiveRegion,
  onSelectModel,
}: {
  onActiveRegion?: (r: Region | null) => void;
  onSelectModel?: (m: AtlasModel | null) => void;
}) {
  const [viewState, setViewState] =
    useState<OrthographicViewState>(INITIAL_VIEW_STATE);
  const [models, setModels] = useState<AtlasModel[]>([]);
  const [markets, setMarkets] = useState<AtlasMarket[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Fetch atlas data once on mount
  useEffect(() => {
    fetch(`${API_URL}/atlas/models`)
      .then((r) => r.json())
      .then((d: { models: AtlasModel[] }) => setModels(d.models ?? []))
      .catch(() => setModels([]));
    fetch(`${API_URL}/atlas/markets`)
      .then((r) => r.json())
      .then((d: { markets: AtlasMarket[] }) => setMarkets(d.markets ?? []))
      .catch(() => setMarkets([]));
  }, []);

  const onClickRegion = useCallback(
    (r: Region) => {
      onActiveRegion?.(r);
      // Fly the camera into the region — push zoom into the entity band
      setViewState((prev) => ({
        ...prev,
        target: [r.position[0], r.position[1], 0],
        zoom: 4,
      }));
    },
    [onActiveRegion],
  );

  const onClickModel = useCallback(
    (m: AtlasModel) => {
      onSelectModel?.(m);
      setHoveredId(m.model_id);
    },
    [onSelectModel],
  );

  const zoom = (viewState.zoom as number) ?? 0;
  const band = bandFromZoom(zoom);

  const layers = useMemo(() => {
    const cosmosLayers = makeCosmosLayers({
      regions: REGIONS,
      onClickRegion,
      zoom,
    });

    const entityOpacity = bandOpacity(zoom, "entity");
    const entityLayers =
      entityOpacity > 0
        ? makeEntityLayers({
            models,
            opacity: entityOpacity,
            onClickModel,
            hoveredId,
          })
        : [];

    return [...cosmosLayers, ...entityLayers];
  }, [zoom, models, onClickRegion, onClickModel, hoveredId]);

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

      {zoom > 0 && (
        <button
          type="button"
          onClick={() => {
            setViewState(INITIAL_VIEW_STATE);
            onActiveRegion?.(null);
            onSelectModel?.(null);
            setHoveredId(null);
          }}
          className="absolute bottom-6 left-6 z-30 font-mono text-[10px] uppercase tracking-widest border border-cyan/50 text-cyan px-3 py-1.5 hover:bg-cyan hover:text-bg transition-colors pointer-events-auto"
        >
          ← back to cosmos
        </button>
      )}

      {/* Zoom band breadcrumb */}
      <div className="absolute bottom-6 right-6 z-20 font-mono text-[10px] uppercase tracking-widest text-white/40 pointer-events-none">
        zoom band · <span className="text-cyan">{band}</span> · z={zoom.toFixed(1)}
      </div>
    </>
  );
}
