# Local Model Setup

PixelBreak's AI engine connects to a locally running [llama.cpp](https://github.com/ggml-org/llama.cpp) server.
No cloud connection. No API key. No data leaves your machine.

---

## 1. Install llama.cpp

### macOS

```bash
brew install llama.cpp
```

Verify:

```bash
llama-server --version
```

### Linux (build from source)

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DLLAMA_CURL=ON
cmake --build build --config Release -j$(nproc)
# Binary: build/bin/llama-server
```

### Windows

Use the pre-built releases from [https://github.com/ggml-org/llama.cpp/releases](https://github.com/ggml-org/llama.cpp/releases).
Download the `llama-*-win-x64.zip` package and extract it.

---

## 2. Download a Model

PixelBreak recommends **Qwen2.5-Coder-Instruct** — a code-focused open-weight model that understands CSS, HTML, and layout issues.

> **License:** Review the [Qwen License Agreement](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct/blob/main/LICENSE) before use.
> PixelBreak does **not** bundle model weights.

### Using the Hugging Face CLI (recommended)

```bash
pip install huggingface_hub   # or: pip3 install huggingface_hub
```

No token required for Qwen2.5 GGUF downloads:

```bash
# 7B model — recommended default (~6 GB RAM)
huggingface-cli download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF \
  qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --local-dir ./models

# 3B model — lower RAM, faster (~3 GB RAM)
huggingface-cli download Qwen/Qwen2.5-Coder-3B-Instruct-GGUF \
  qwen2.5-coder-3b-instruct-q4_k_m.gguf \
  --local-dir ./models

# 14B model — higher quality, more RAM (~10 GB)
huggingface-cli download Qwen/Qwen2.5-Coder-14B-Instruct-GGUF \
  qwen2.5-coder-14b-instruct-q4_k_m.gguf \
  --local-dir ./models
```

### Using wget / curl

```bash
# Find the direct download URL on the model's HuggingFace page
# Example for 7B Q4_K_M:
wget "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf" \
  -O ./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf
```

---

## 3. Start the llama.cpp Server

```bash
llama-server \
  --model ./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --port 8080 \
  --ctx-size 4096 \
  --host 127.0.0.1
```

The server must be running before you use `pixelbreak check` or `pixelbreak ai status`.

### Recommended flags

| Flag | Value | Notes |
|------|-------|-------|
| `--port` | `8080` | Must match `ai.endpoint` in `.pixelbreak.yml` |
| `--ctx-size` | `4096` | Sufficient for PixelBreak prompts |
| `--host` | `127.0.0.1` | Restricts to localhost only (recommended) |
| `--n-gpu-layers` | `-1` | Offload all layers to GPU if available |
| `--threads` | `$(nproc)` | Use all CPU threads |

### GPU acceleration (optional)

llama.cpp supports Metal (macOS), CUDA, and ROCm. To enable Metal on macOS:

```bash
cmake -B build -DLLAMA_METAL=ON
cmake --build build --config Release -j$(nproc)
llama-server --model ./models/... --port 8080 --n-gpu-layers -1
```

---

## 4. Verify Connectivity

```bash
node apps/runner/dist/cli.js ai status
```

Expected output:
```
🤖 Checking local AI endpoint: http://localhost:8080

✅ Local AI is available
   Model:   qwen2.5-coder-7b-instruct-q4_k_m
   Latency: 42ms
```

---

## 5. Hardware Requirements

| Model | Quantization | RAM (CPU) | Notes |
|-------|-------------|-----------|-------|
| Qwen2.5-Coder-3B | Q4_K_M | ~3 GB | Fast, adequate for simple issues |
| Qwen2.5-Coder-7B | Q4_K_M | ~6 GB | **Recommended default** |
| Qwen2.5-Coder-14B | Q4_K_M | ~10 GB | Best quality, slower on CPU |

GPU acceleration can reduce inference time significantly on Apple Silicon or CUDA-capable GPUs.

---

## 6. Configuration

In `.pixelbreak.yml`, the AI section controls endpoint and model settings:

```yaml
ai:
  provider: local
  endpoint: http://localhost:8080   # llama.cpp server URL
  model: qwen2.5-coder-7b          # optional — shown in ai status output
  requiredForExplanations: true     # fail if AI unavailable when findings exist
  requiredForFixSuggestions: true
```

If `requiredForExplanations` is `true` and llama.cpp is not running when PixelBreak finds a blocking issue, PixelBreak will show a clear error. It will **not** silently fall back to a hosted service.

---

## 7. Troubleshooting

### "Local AI is unavailable — ECONNREFUSED"
llama.cpp is not running. Start the server with the command in step 3.

### "AI response failed schema validation"
The model produced unexpected output. Try:
- Increasing `--ctx-size` (4096 minimum recommended)
- Lowering temperature: PixelBreak uses `temperature: 0.1` by default

### Slow inference
- Enable GPU acceleration (`--n-gpu-layers -1`)
- Use a smaller quantization (`Q3_K_S`) or smaller model (3B)
- Increase thread count (`--threads $(nproc)`)

### Model not found on HuggingFace
The GGUF repository name may change. Search for "Qwen2.5-Coder GGUF" on [huggingface.co](https://huggingface.co) and substitute the correct repository name.
