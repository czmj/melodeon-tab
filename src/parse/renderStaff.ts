import { renderAbc } from "abcjs";

export interface StaffAnchor {
  startChar: number;
  x: number;
  y: number;
}

const SCREEN_HORIZONTAL_PADDING = 30;
const LAYOUT_DIRECTIVES = "%%stretchlast 1\n%%staffsep 90\n%%musicspace 30\n";

export function renderStaffNotation(
  target: HTMLElement,
  abc: string,
  width: number,
): StaffAnchor[] {
  let visual;
  try {
    const staffwidth = Math.max(0, width - SCREEN_HORIZONTAL_PADDING);
    visual = renderAbc(target, LAYOUT_DIRECTIVES + abc, {
      staffwidth,
      add_classes: true,
      selectTypes: false,
      wrap:
        width < 640
          ? { preferredMeasuresPerLine: 2, minSpacing: 3, maxSpacing: 6 }
          : width < 980
            ? { preferredMeasuresPerLine: 4, minSpacing: 3, maxSpacing: 6 }
            : undefined,
    })[0];
  } catch {
    target.textContent = "Could not render notation.";
    return [];
  }

  const container = target.getBoundingClientRect();
  const anchors: StaffAnchor[] = [];
  for (const line of visual.lines) {
    if (!line.staff) continue;
    for (const staff of line.staff) {
      for (const voice of staff.voices ?? []) {
        for (const el of voice) {
          if (el.el_type !== "note") continue;
          const svg = (el as { abselem?: { elemset?: SVGGraphicsElement[] } })
            .abselem?.elemset?.[0];
          const startChar = (el as { startChar?: number }).startChar;
          if (!svg || startChar === undefined) continue;
          const rect = svg.getBoundingClientRect();
          anchors.push({
            startChar: startChar - LAYOUT_DIRECTIVES.length,
            x: rect.left - container.left + rect.width / 2,
            y: rect.top - container.top,
          });
        }
      }
    }
  }

  return anchors;
}
