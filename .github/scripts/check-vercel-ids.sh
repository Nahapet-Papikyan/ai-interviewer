#!/usr/bin/env bash
set -euo pipefail

fail=0

echo "VERCEL_ORG_ID length: ${#VERCEL_ORG_ID}"
echo "VERCEL_PROJECT_ID length: ${#VERCEL_PROJECT_ID}"
echo "VERCEL_TOKEN length: ${#VERCEL_TOKEN}"

if [[ "$VERCEL_ORG_ID" == team_* ]]; then
  echo "VERCEL_ORG_ID format: ok (team_…)"
else
  echo "::error::VERCEL_ORG_ID must be the Vercel Team ID, starting with team_. Do not use the GitHub environment id (the number in the URL)."
  fail=1
fi

if [[ "$VERCEL_PROJECT_ID" == prj_* ]]; then
  echo "VERCEL_PROJECT_ID format: ok (prj_…)"
else
  echo "::error::VERCEL_PROJECT_ID must be the Vercel Project ID, starting with prj_."
  fail=1
fi

if [[ ${#VERCEL_TOKEN} -lt 20 ]]; then
  echo "::error::VERCEL_TOKEN looks too short. Create a new token at https://vercel.com/account/tokens while logged into the same Vercel account that owns the project."
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
