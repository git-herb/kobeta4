import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const fontsReady = Promise.all([
  loadFont({ family: "Pretendard", url: staticFile("fonts/Pretendard-ExtraBold.woff2"), weight: "800" }),
  loadFont({ family: "Pretendard", url: staticFile("fonts/Pretendard-Medium.woff2"), weight: "500" }),
  loadFont({ family: "JetBrains Mono", url: staticFile("fonts/JetBrainsMono-Medium.woff2"), weight: "500" }),
]);
