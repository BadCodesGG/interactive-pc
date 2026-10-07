import { Cable, CircuitBoard, Cpu, Fan, Gpu, HardDrive, MemoryStick, Microchip, PanelLeft, PanelRight, PanelTop, PcCase, Plug, Snowflake, type LucideIcon } from "lucide-react";
import type { CatalogueKind } from "@/data/catalogue";

/** The icon for each kind of catalogue part: the spec sheet's rows. */
export const KIND_ICON: Record<CatalogueKind, LucideIcon> = {
  case: PcCase,
  motherboard: CircuitBoard,
  cpu: Cpu,
  cooler: Snowflake,
  ram: MemoryStick,
  gpu: Gpu,
  nvme: Microchip,
  ssd: HardDrive,
  psu: Plug,
  fan: Fan,
};

/** The icon for each part of the 3D model, by sidecar id: the build tray's cards. */
export const PART_ICON: Record<string, LucideIcon> = {
  psu: Plug,
  motherboard: CircuitBoard,
  cpu: Cpu,
  ram_1: MemoryStick,
  ram_2: MemoryStick,
  ram_3: MemoryStick,
  ram_4: MemoryStick,
  nvme: Microchip,
  cooler: Snowflake,
  fan_front: Fan,
  fan_rear: Fan,
  gpu: Gpu,
  ssd_sata: HardDrive,
  cables: Cable,
  panel_left: PanelLeft,
  panel_right: PanelRight,
  panel_front: PanelTop,
  case_frame: PcCase,
};
