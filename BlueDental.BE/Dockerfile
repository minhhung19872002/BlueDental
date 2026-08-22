FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY common.props ./
COPY *.sln ./

COPY src/BlueDental.Domain.Shared/BlueDental.Domain.Shared.csproj src/BlueDental.Domain.Shared/
COPY src/BlueDental.Domain/BlueDental.Domain.csproj src/BlueDental.Domain/
COPY src/BlueDental.Application.Contracts/BlueDental.Application.Contracts.csproj src/BlueDental.Application.Contracts/
COPY src/BlueDental.Application/BlueDental.Application.csproj src/BlueDental.Application/
COPY src/BlueDental.EntityFrameworkCore/BlueDental.EntityFrameworkCore.csproj src/BlueDental.EntityFrameworkCore/
COPY src/BlueDental.HttpApi/BlueDental.HttpApi.csproj src/BlueDental.HttpApi/
COPY src/BlueDental.HttpApi.Host/BlueDental.HttpApi.Host.csproj src/BlueDental.HttpApi.Host/
COPY src/BlueDental.HttpApi.Client/BlueDental.HttpApi.Client.csproj src/BlueDental.HttpApi.Client/
COPY src/BlueDental.DbMigrator/BlueDental.DbMigrator.csproj src/BlueDental.DbMigrator/

RUN dotnet restore src/BlueDental.HttpApi.Host/BlueDental.HttpApi.Host.csproj
RUN dotnet restore src/BlueDental.DbMigrator/BlueDental.DbMigrator.csproj

COPY . .

RUN dotnet publish src/BlueDental.HttpApi.Host/BlueDental.HttpApi.Host.csproj \
    -c Release -o /app/api --no-restore

RUN dotnet publish src/BlueDental.DbMigrator/BlueDental.DbMigrator.csproj \
    -c Release -o /app/migrator --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/api ./api
COPY --from=build /app/migrator ./migrator

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=20 --start-period=30s \
    CMD curl --fail http://127.0.0.1:8080/health/ready || exit 1

WORKDIR /app/api
ENTRYPOINT ["dotnet", "BlueDental.HttpApi.Host.dll"]
