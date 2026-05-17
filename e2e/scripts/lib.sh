#!/usr/bin/env bash
# Shared constants + helpers used by every pilot script.

# Deployer wallet (also TaskRegistry owner + API signer)
DEPLOYER_KEY=0xba079b8809efe14d18be8c1894c9589d3555476230c3dc5502af751d6e0c375a
DEPLOYER_ADDR=0xe95d5cF4459Cff5504186F02490edfA477F6f45C

# Kite testnet
RPC=https://rpc-testnet.gokite.ai
CHAIN_ID=2368
EXPLORER=https://testnet.kitescan.ai

# Contracts (Kite Testnet)
USDC=0x2ec2814c6f623E9e2393CcbB7b751Fc4e74ab4c5
PASSPORT=0xb32B7CD58B137E711EF2577a857eF3A972A81425
ESCROW=0x31D53eB4650E8099E9eD3A852c1DFb4a8ccF6C44
REGISTRY=0x9c06F4efAb5B734D1Da3F82Ef88E802146F6ed03

# Project paths
ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
AGENTS_VENV="$ROOT/agents/.venv/bin/python"

# Pretty output
BOLD=$'\e[1m'
DIM=$'\e[2m'
GREEN=$'\e[32m'
YELLOW=$'\e[33m'
CYAN=$'\e[36m'
RESET=$'\e[0m'

section() { printf "\n${BOLD}${CYAN}━━━ %s ━━━${RESET}\n" "$*"; }
info()    { printf "${DIM}%s${RESET}\n" "$*"; }
ok()      { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()    { printf "${YELLOW}!${RESET} %s\n" "$*"; }
pause()   { printf "\n${YELLOW}▶ %s${RESET}\n  ${DIM}(press Enter to continue)${RESET} " "$*"; read -r; }
