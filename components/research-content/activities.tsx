import type { PavilionId } from "@/lib/experience-contract";

/** Compatibility for experience callers. Reading is free and has no completion state. */
export type ActivityProps = {
  onComplete?: (id: PavilionId) => void;
  onInteract?: () => void;
  completed?: boolean;
};
