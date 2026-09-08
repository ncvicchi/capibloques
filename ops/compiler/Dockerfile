FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS generator
WORKDIR /opt/capi
COPY ops/compiler/generator/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM python:3.12-slim-bookworm@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254
ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    IDF_PATH=/opt/esp/idf IDF_TOOLS_PATH=/opt/esp/tools IDF_TARGET=esp32 \
    IDF_PY_BUILD_JOBS=1 IDF_CCACHE_ENABLE=0 HOME=/work/home
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates cmake ninja-build build-essential libffi-dev libssl-dev libusb-1.0-0 pkg-config \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --branch v5.5.5 --depth 1 --recursive --shallow-submodules https://github.com/espressif/esp-idf.git /opt/esp/idf \
    && /opt/esp/idf/install.sh esp32 \
    && rm -rf /opt/esp/tools/dist /root/.cache/pip
COPY --from=generator /usr/local/bin/node /usr/local/bin/node
COPY --from=generator /opt/capi /opt/capi
COPY ops/compiler/arduino-cli.yaml /opt/arduino/arduino-cli.yaml
RUN curl -fL --retry 3 https://github.com/arduino/arduino-cli/releases/download/v1.5.1/arduino-cli_1.5.1_Linux_64bit.tar.gz -o /tmp/arduino-cli.tar.gz \
    && echo '28a8e119c498a25607821c36cb2dc49e8463941b261a0d99091baa7bc692dd2b  /tmp/arduino-cli.tar.gz' | sha256sum -c - \
    && tar -xzf /tmp/arduino-cli.tar.gz -C /usr/local/bin arduino-cli \
    && arduino-cli --config-file /opt/arduino/arduino-cli.yaml core update-index \
    && arduino-cli --config-file /opt/arduino/arduino-cli.yaml core install esp32:esp32@3.3.11 \
    && arduino-cli --config-file /opt/arduino/arduino-cli.yaml lib install 'LiquidCrystal_PCF8574@2.3.0' 'U8g2@2.36.19' 'GFX Library for Arduino@1.6.7' \
    && rm -rf /tmp/arduino-cli.tar.gz /tmp/arduino-downloads /opt/arduino/data/staging
COPY lib /opt/capi/lib
COPY scripts/compiler-generate.mjs /opt/capi/scripts/compiler-generate.mjs
COPY ops/compiler/entry.py ops/compiler/archive.py /opt/capi/
WORKDIR /work
USER 10000:10000
ENTRYPOINT ["python", "/opt/capi/entry.py"]
