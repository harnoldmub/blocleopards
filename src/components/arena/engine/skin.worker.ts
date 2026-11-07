/// <reference lib="webworker" />
import { computeSkin, type SkinInput } from "./skinTransfer";

self.onmessage = (e: MessageEvent<SkinInput>) => {
  const out = computeSkin(e.data);
  (self as unknown as Worker).postMessage(out, [out.skI.buffer, out.skW.buffer]);
};
