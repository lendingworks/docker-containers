# Project: https://github.com/danielpalme/ReportGenerator

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:5.0 AS builder

WORKDIR /source

ENV REPORT_GENERATOR_VERSION="4.8.2"

RUN dotnet tool install \
  dotnet-reportgenerator-globaltool \
  --tool-path /app \
  --version ${REPORT_GENERATOR_VERSION}

# Run stage.
FROM mcr.microsoft.com/dotnet/runtime:5.0 AS runner

WORKDIR /app

# There are other required directories within the /app folder created by
# `dotnet tool install`, not just the binary.
COPY --from=builder /app .

CMD ["/app/reportgenerator"]
