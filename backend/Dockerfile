FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
WORKDIR /src
COPY ["ChatApp.csproj", "./"]
RUN dotnet restore "ChatApp.csproj"
COPY . .
RUN dotnet build "ChatApp.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ChatApp.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:7.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 80
EXPOSE 443
ENTRYPOINT ["dotnet", "ChatApp.dll"] 