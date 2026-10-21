# Third-Party Notices

PixelBreak application code is licensed under the MIT License. This file lists the third-party open-source software included in or used by PixelBreak, along with their respective licenses.

---

## Runtime Dependencies

| Package | Version | License | Repository |
|---------|---------|---------|-----------|
| [commander](https://www.npmjs.com/package/commander) | ^13.1.0 | MIT | https://github.com/tj/commander.js |
| [pixelmatch](https://www.npmjs.com/package/pixelmatch) | ^7.1.0 | ISC | https://github.com/mapbox/pixelmatch |
| [playwright](https://www.npmjs.com/package/playwright) | ^1.50.0 | Apache-2.0 | https://github.com/microsoft/playwright |
| [pngjs](https://www.npmjs.com/package/pngjs) | ^7.0.0 | MIT | https://github.com/lukeapage/pngjs |
| [yaml](https://www.npmjs.com/package/yaml) | ^2.7.0 | ISC | https://github.com/eemeli/yaml |
| [zod](https://www.npmjs.com/package/zod) | ^3.24.1 | MIT | https://github.com/colinhacks/zod |

---

## Development-Only Dependencies

The following packages are used only during development and testing. They are not included in the distributed application:

| Package | License |
|---------|---------|
| @types/node | MIT |
| @types/pixelmatch | MIT |
| @types/pngjs | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |
| vite (fixture app only) | MIT |

---

## Playwright Browser Binaries

Playwright downloads Chromium browser binaries for browser automation. These binaries are governed by their own licenses:

- **Chromium:** BSD-style license — https://chromium.googlesource.com/chromium/src/+/main/LICENSE
- Playwright downloads browser binaries at install time. PixelBreak does not bundle these binaries.

---

## Local LLM Model Weights

PixelBreak's Local AI Engine connects to a locally running llama.cpp server. **Model weights are not bundled with PixelBreak.**

The recommended model is **Qwen2.5-Coder-Instruct** by Alibaba Cloud:

- **License:** Qwen License Agreement — https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct/blob/main/LICENSE
- **Repository:** https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct
- **Note:** Review the Qwen License Agreement before use. The license allows commercial use subject to its terms.

Users who choose a different model are responsible for reviewing and complying with that model's license.

---

## llama.cpp

PixelBreak's AI engine communicates with a locally running [llama.cpp](https://github.com/ggml-org/llama.cpp) server over HTTP. llama.cpp is not bundled with PixelBreak.

- **License:** MIT — https://github.com/ggml-org/llama.cpp/blob/master/LICENSE

---

## Full License Texts

The full text of each license is available at the links above or via `npm show <package> license`.

---

*This file was last updated: 2026-10-21*
