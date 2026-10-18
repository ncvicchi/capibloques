# Reuse the installed SDKs/cores. Only generator sources vary between branches.
ARG CAPI_COMPILER_BASE
FROM ${CAPI_COMPILER_BASE}
USER root
COPY lib /opt/capi/lib
COPY scripts/compiler-generate.mjs /opt/capi/scripts/compiler-generate.mjs
COPY ops/compiler/entry.py ops/compiler/archive.py /opt/capi/
USER 10000:10000
