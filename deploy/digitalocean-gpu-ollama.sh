#!/usr/bin/env bash
# DigitalOcean GPU Droplet (RTX 4000 Ada / L40S) 1-Click Ollama + Gemma 3 Vision Setup
set -euo pipefail

echo "[1/4] Installing Ollama on DigitalOcean GPU Droplet..."
curl -fsSL https://ollama.com/install.sh | sh

echo "[2/4] Configuring Ollama to listen on VPC interface for App Platform..."
mkdir -p /etc/systemd/system/ollama.service.d
cat <<EOF >/etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=https://realitycompiler.tech,http://localhost:5173"
EOF

systemctl daemon-reload
systemctl restart ollama

echo "[3/4] Pulling Google open-weight multimodal model gemma3:4b..."
ollama pull gemma3:4b

echo "[4/4] Verifying gemma3:4b readiness..."
ollama list | grep gemma3
echo "Reality Compiler Gemma 3 Vision runtime ready on port 11434."
